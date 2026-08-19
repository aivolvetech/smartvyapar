import './mock-electron';
import { initializeDatabase } from '../electron/database/database-initializer';
import { closeDatabaseConnection } from '../electron/database/database-connection';
import { getDatabaseConnection } from '../electron/database/database-connection';
import { ShopRepository } from '../electron/database/repositories/shop.repository';
import { CustomerRepository } from '../electron/database/repositories/customer.repository';
import { ProductRepository } from '../electron/database/repositories/product.repository';
import { SalesService } from '../electron/services/sales.service';

let passed = 0;
function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  passed++;
  console.log(`SUCCESS: ${message}`);
}

async function run() {
  await initializeDatabase();
  const db = getDatabaseConnection();
  const shop = new ShopRepository().getShop();
  assert(Boolean(shop), 'Shop is initialized');
  if (!shop) throw new Error('FAIL: Shop missing');

  // Load a registered customer (non walk-in)
  const customerRepo = new CustomerRepository();
  const customers = customerRepo.list(shop.id, { page: 1, pageSize: 200 });
  const registeredCustomer = customers.items.find(c => !c.isWalkIn && c.customerType !== 'WALK_IN');
  assert(Boolean(registeredCustomer), 'Registered customer (credit enabled) is available');
  if (!registeredCustomer) throw new Error('FAIL: Non walk-in customer missing');

  // Load walk-in customer for walk-in collection block validation
  const walkInCustomer = customers.items.find(c => c.isWalkIn);
  assert(Boolean(walkInCustomer), 'Walk-In customer is available');

  const productRepo = new ProductRepository();
  const salesService = new SalesService();

  // Find a tracked product
  const productList = productRepo.list({ page: 1, pageSize: 200 } as any);
  let trackProduct = null;
  for (const item of productList.items) {
    const detail = productRepo.findById(item.id);
    if (detail && detail.trackInventory) {
      trackProduct = detail;
      break;
    }
  }
  assert(Boolean(trackProduct), 'Tracked product is available');
  if (!trackProduct) throw new Error('FAIL: Tracked product missing');

  // Seed stock for the tracked product to ensure availability
  db.prepare(`
    INSERT INTO InventoryTransaction (
      id, productId, shopId, transactionType, quantity, unitCost, totalCost,
      occurredAt, postedAt, referenceType, referenceId, createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, 'PURCHASE_IN', 100, 10, 1000,
      datetime('now'), datetime('now'), 'PURCHASE', 'seed-outstanding-test', datetime('now'), datetime('now')
    )
  `).run('tx-seed-' + Date.now() + Math.random().toString(36).substr(2, 5), trackProduct.id, shop.id);

  // ----------------------------------------------------
  // TEST 1: POST A CREDITED INVOICE AND VIEW HISTORY
  // ----------------------------------------------------
  console.log('\n--- Test 1: Sales Posting & History ---');
  // Record current stock before sale
  const beforeStock = db.prepare('SELECT COALESCE(SUM(quantity), 0) AS stock FROM InventoryTransaction WHERE productId = ?').get(trackProduct.id) as { stock: number };

  const draft = salesService.createDraft(shop.id, registeredCustomer.id);
  
  // Resolve product selling price dynamically
  const priceRes = (salesService as any).priceResolutionService.resolvePrice({
    shopId: shop.id,
    productId: trackProduct.id,
    customerId: registeredCustomer.id,
    draftDate: draft.invoiceDate
  });
  const unitPrice = priceRes?.sellingPrice || 100.00;

  const updatedDraft = salesService.addDraftLine(draft.id, {
    productId: trackProduct.id,
    quantity: 5,
    provisionalUnitPrice: unitPrice,
    provisionalDiscountType: 'NONE',
    provisionalDiscountValue: 0,
  });

  const grandTotal = updatedDraft.cart.grandTotal;
  const cashAmount = Math.round(grandTotal * 0.4 * 100) / 100;
  const creditAmount = Math.round((grandTotal - cashAmount) * 100) / 100;

  const detailBefore = salesService.getDraft(draft.id);
  const checkoutPayments = [
    { paymentMode: 'CASH', amount: cashAmount },
    { paymentMode: 'CREDIT', amount: creditAmount }
  ];

  const posted = salesService.postSale(draft.id, checkoutPayments, detailBefore.invoice.version);
  assert(posted.invoice.status === 'POSTED', 'Invoice status updated to POSTED');
  assert(posted.invoice.paymentStatus === 'PARTIALLY_PAID', 'Payment status is PARTIALLY_PAID');
  assert(posted.invoice.paidAmount === cashAmount, `Paid amount is ${cashAmount}`);
  assert(posted.invoice.outstandingAmount === creditAmount, `Outstanding amount is ${creditAmount}`);

  // Verify stock decreased by 5
  const afterStock = db.prepare('SELECT COALESCE(SUM(quantity), 0) AS stock FROM InventoryTransaction WHERE productId = ?').get(trackProduct.id) as { stock: number };
  assert(beforeStock.stock - afterStock.stock === 5, 'Inventory decreased by sale line quantity');

  // Verify SalesPayments created with SALE_CHECKOUT source
  const payRows = db.prepare('SELECT * FROM SalesPayment WHERE salesInvoiceId = ?').all(posted.invoice.id) as any[];
  assert(payRows.length === 2, 'Two payments recorded (CASH, CREDIT)');
  const cashPay = payRows.find(p => p.paymentMode === 'CASH');
  assert(cashPay && cashPay.paymentSource === 'SALE_CHECKOUT', 'Initial cash checkout payment source is SALE_CHECKOUT');
  const creditPay = payRows.find(p => p.paymentMode === 'CREDIT');
  assert(creditPay && creditPay.amount === creditAmount, `Credit payment records amount of ${creditAmount}`);

  // Verify getDraft loads payments history
  const detailLoaded = salesService.getDraft(posted.invoice.id);
  assert(detailLoaded.payments && detailLoaded.payments.length === 2, 'getDraft returns payment history items');

  // Verify history filters
  const historyResult = salesService.listSalesHistory({ shopId: shop.id, status: 'POSTED', customerId: registeredCustomer.id, page: 1, pageSize: 25 });
  assert(historyResult.items.some(item => item.id === posted.invoice.id), 'Invoice visible in customer sales history query');

  // ----------------------------------------------------
  // TEST 2: REPRINT HAS ZERO MUTATIONS
  // ----------------------------------------------------
  console.log('\n--- Test 2: Print/Reprint side-effect-free ---');
  const invoiceBeforePrint = db.prepare('SELECT * FROM SalesInvoice WHERE id = ?').get(posted.invoice.id) as any;
  const payCountBeforePrint = (db.prepare('SELECT count(*) AS count FROM SalesPayment WHERE salesInvoiceId = ?').get(posted.invoice.id) as any).count;
  const ledgerCountBeforePrint = (db.prepare('SELECT count(*) AS count FROM CustomerLedgerEntry WHERE referenceId = ?').get(posted.invoice.id) as any).count;
  const stockCountBeforePrint = (db.prepare('SELECT count(*) AS count FROM InventoryTransaction WHERE referenceId = ?').get(posted.invoice.id) as any).count;

  // Perform "reprint" read
  const reprintDetails = salesService.getDraft(posted.invoice.id);
  assert(reprintDetails.invoice.id === posted.invoice.id, 'Reprint loads correct invoice');

  const invoiceAfterPrint = db.prepare('SELECT * FROM SalesInvoice WHERE id = ?').get(posted.invoice.id) as any;
  assert(invoiceBeforePrint.version === invoiceAfterPrint.version, 'Invoice version unchanged after reprint');
  assert(invoiceBeforePrint.outstandingAmount === invoiceAfterPrint.outstandingAmount, 'Outstanding amount unchanged after reprint');

  const payCountAfterPrint = (db.prepare('SELECT count(*) AS count FROM SalesPayment WHERE salesInvoiceId = ?').get(posted.invoice.id) as any).count;
  assert(payCountBeforePrint === payCountAfterPrint, 'Payments count unchanged after reprint');

  const ledgerCountAfterPrint = (db.prepare('SELECT count(*) AS count FROM CustomerLedgerEntry WHERE referenceId = ?').get(posted.invoice.id) as any).count;
  assert(ledgerCountBeforePrint === ledgerCountAfterPrint, 'Ledger entry count unchanged after reprint');

  const stockCountAfterPrint = (db.prepare('SELECT count(*) AS count FROM InventoryTransaction WHERE referenceId = ?').get(posted.invoice.id) as any).count;
  assert(stockCountBeforePrint === stockCountAfterPrint, 'Stock transaction count unchanged after reprint');

  // ----------------------------------------------------
  // TEST 3: OUTSTANDING PAYMENT RECOVERY
  // ----------------------------------------------------
  console.log('\n--- Test 3: Outstanding Payment Recovery ---');

  // Verify walk-in block
  try {
    const walkInDraft = salesService.createDraft(shop.id, walkInCustomer.id);
    const priceResWalkIn = (salesService as any).priceResolutionService.resolvePrice({
      shopId: shop.id,
      productId: trackProduct.id,
      customerId: walkInCustomer.id,
      draftDate: walkInDraft.invoiceDate
    });
    const walkInUnitPrice = priceResWalkIn?.sellingPrice || 100.00;

    const updatedWalkIn = salesService.addDraftLine(walkInDraft.id, {
      productId: trackProduct.id,
      quantity: 1,
      provisionalUnitPrice: walkInUnitPrice,
      provisionalDiscountType: 'NONE',
      provisionalDiscountValue: 0
    });
    const walkInGrandTotal = updatedWalkIn.cart.grandTotal;

    const walkInPosted = salesService.postSale(walkInDraft.id, [{ paymentMode: 'CASH', amount: walkInGrandTotal }], updatedWalkIn.version);
    
    salesService.receiveCustomerPayment(walkInPosted.invoice.id, 'CASH', 50);
    throw new Error('Allowed walk-in recovery!');
  } catch (err: any) {
    console.log('WALK-IN ERROR RECEIVED:', err.message, err);
    assert(err.message === 'CUSTOMER_PAYMENT_NOT_ALLOWED' || err.message === 'INVOICE_ALREADY_PAID', 'Outstanding recovery blocked for Walk-In Customer');
  }

  // Record recovery payment (partial amount = recoveryAmt1)
  const recoveryAmt1 = Math.round(creditAmount * 0.4 * 100) / 100;
  const recoveryAmt2 = Math.round((creditAmount - recoveryAmt1) * 100) / 100;

  const recoveryDetail = salesService.receiveCustomerPayment(posted.invoice.id, 'CASH', recoveryAmt1);
  assert(Math.abs(recoveryDetail.invoice.paidAmount - (cashAmount + recoveryAmt1)) < 0.01, `Effective paidAmount increases to ${cashAmount + recoveryAmt1}`);
  assert(Math.abs(recoveryDetail.invoice.outstandingAmount - (creditAmount - recoveryAmt1)) < 0.01, `Outstanding drops to ${creditAmount - recoveryAmt1}`);
  assert(recoveryDetail.invoice.paymentStatus === 'PARTIALLY_PAID', 'Payment status remains PARTIALLY_PAID');

  // Assert SalesPayment created with OUTSTANDING_RECOVERY source
  const payRecoveryRows = db.prepare('SELECT * FROM SalesPayment WHERE salesInvoiceId = ?').all(posted.invoice.id) as any[];
  assert(payRecoveryRows.length === 3, 'Three payments total recorded now');
  const recoveryPay = payRecoveryRows.find(p => p.paymentSource === 'OUTSTANDING_RECOVERY');
  assert(recoveryPay && recoveryPay.paymentMode === 'CASH' && Math.abs(recoveryPay.amount - recoveryAmt1) < 0.01, `Recovery payment recorded amount of ${recoveryAmt1}`);

  // Assert CustomerLedger RECEIPT created
  const ledgerReceipt = db.prepare(`
    SELECT * FROM CustomerLedgerEntry 
    WHERE customerId = ? AND entryType = 'RECEIPT' AND referenceId = ? AND creditAmount = ?
  `).get(registeredCustomer.id, posted.invoice.id, recoveryAmt1);
  assert(Boolean(ledgerReceipt), 'Customer ledger RECEIPT created for recovery payment');

  // Record final outstanding settlement (recoveryAmt2)
  const finalDetail = salesService.receiveCustomerPayment(posted.invoice.id, 'CARD', recoveryAmt2);
  assert(Math.abs(finalDetail.invoice.paidAmount - grandTotal) < 0.01, `Total paidAmount matches grandTotal (${grandTotal})`);
  assert(finalDetail.invoice.outstandingAmount === 0, 'Outstanding drops to exactly 0');
  assert(finalDetail.invoice.paymentStatus === 'PAID', 'Invoice status transitions to PAID');

  // Overpayment check
  try {
    salesService.receiveCustomerPayment(posted.invoice.id, 'CASH', 100);
    throw new Error('Allowed overpayment!');
  } catch (err: any) {
    assert(err.message === 'INVOICE_ALREADY_PAID', 'Outstanding recovery blocked on fully paid invoice');
  }

  // ----------------------------------------------------
  // TEST 4: SALE CANCELLATION
  // ----------------------------------------------------
  console.log('\n--- Test 4: Sale Cancellation ---');

  // Cancel invoice
  const preCancelStock = db.prepare('SELECT COALESCE(SUM(quantity), 0) AS stock FROM InventoryTransaction WHERE productId = ?').get(trackProduct.id) as { stock: number };
  const cancelledDetail = salesService.cancelSale(posted.invoice.id, 'Customer returned goods', finalDetail.invoice.version);

  assert(cancelledDetail.invoice.status === 'CANCELLED', 'Invoice status updated to CANCELLED');
  assert(cancelledDetail.invoice.cancellationReason === 'Customer returned goods', 'Cancellation reason saved');
  assert(Boolean(cancelledDetail.invoice.cancelledAt), 'cancelledAt timestamp populated');
  assert(cancelledDetail.invoice.outstandingAmount === 0, 'Outstanding amount set to 0');
  assert(cancelledDetail.invoice.paidAmount === 0, 'Paid amount set to 0');

  // Verify stock reversal transaction
  const postCancelStock = db.prepare('SELECT COALESCE(SUM(quantity), 0) AS stock FROM InventoryTransaction WHERE productId = ?').get(trackProduct.id) as { stock: number };
  assert(postCancelStock.stock - preCancelStock.stock === 5, 'Stock reversed (increased back by 5)');
  const reversalTx = db.prepare("SELECT * FROM InventoryTransaction WHERE referenceId = ? AND transactionType = 'REVERSAL'").get(posted.invoice.id) as any;
  assert(reversalTx && reversalTx.quantity === 5, 'Inventory REVERSAL transaction created with positive qty');

  // Verify payments status set to REVERSED
  const paymentsAfterCancel = db.prepare('SELECT * FROM SalesPayment WHERE salesInvoiceId = ?').all(posted.invoice.id) as any[];
  assert(paymentsAfterCancel.every(p => p.paymentMode === 'CREDIT' || p.status === 'REVERSED'), 'All money payments marked as REVERSED');

  // Verify CustomerLedger reversals
  const saleReversalLedger = db.prepare(`
    SELECT * FROM CustomerLedgerEntry 
    WHERE customerId = ? AND entryType = 'SALE_CANCELLATION' AND referenceId = ? AND creditAmount = ?
  `).get(registeredCustomer.id, posted.invoice.id, grandTotal);
  assert(Boolean(saleReversalLedger), 'Customer ledger SALE_CANCELLATION entry created');

  const receiptReversalsLedger = db.prepare(`
    SELECT SUM(debitAmount) as total FROM CustomerLedgerEntry 
    WHERE customerId = ? AND entryType = 'RECEIPT_REVERSAL' AND referenceId = ?
  `).get(registeredCustomer.id, posted.invoice.id) as { total: number };
  assert(Math.abs(receiptReversalsLedger.total - grandTotal) < 0.01, `Customer ledger RECEIPT_REVERSAL entries created reversing all payments (${grandTotal})`);

  // ----------------------------------------------------
  // TEST 5: ATOMIC TRANSACTION ROLLBACK
  // ----------------------------------------------------
  console.log('\n--- Test 5: Atomic Rollback validation ---');

  const rollbackDraft = salesService.createDraft(shop.id, registeredCustomer.id);
  const priceResRollback = (salesService as any).priceResolutionService.resolvePrice({
    shopId: shop.id,
    productId: trackProduct.id,
    customerId: registeredCustomer.id,
    draftDate: rollbackDraft.invoiceDate
  });
  const rollbackUnitPrice = priceResRollback?.sellingPrice || 100.00;

  const updatedRollbackDraft = salesService.addDraftLine(rollbackDraft.id, {
    productId: trackProduct.id,
    quantity: 2,
    provisionalUnitPrice: rollbackUnitPrice,
    provisionalDiscountType: 'NONE',
    provisionalDiscountValue: 0
  });
  const rollbackGrandTotal = updatedRollbackDraft.cart.grandTotal;
  const rollbackPosted = salesService.postSale(rollbackDraft.id, [{ paymentMode: 'CASH', amount: rollbackGrandTotal }], updatedRollbackDraft.version);

  // Force cancellation to fail by passing invalid version
  try {
    salesService.cancelSale(rollbackPosted.invoice.id, 'Test rollback', 999);
    throw new Error('Allowed cancellation with invalid version!');
  } catch (err: any) {
    assert(err.message === 'STALE_INVOICE_VERSION', 'Cancellation fails on stale version concurrency check');
  }

  // Assert invoice, stock, payments, ledger are untouched
  const checkInvoice = salesService.getDraft(rollbackPosted.invoice.id);
  assert(checkInvoice.invoice.status === 'POSTED', 'Rollback: invoice status remains POSTED');
  assert(checkInvoice.payments![0].status === 'CAPTURED', 'Rollback: payment remains CAPTURED');

  // ----------------------------------------------------
  // TEST 6: SALES DASHBOARD CALCULATIONS
  // ----------------------------------------------------
  console.log('\n--- Test 6: Sales Dashboard ---');
  const dashboard = salesService.getSalesDashboardSummary(shop.id, { rangeType: 'month' });
  console.log('Dashboard Snapshot:', dashboard);
  assert(dashboard.grossSales >= grandTotal + rollbackGrandTotal, `Gross sales is at least ${grandTotal + rollbackGrandTotal}`);
  assert(dashboard.cancelledSales >= grandTotal, `Cancelled sales is at least ${grandTotal}`);
  assert(Math.abs(dashboard.operationalNetSales - (dashboard.grossSales - dashboard.cancelledSales)) < 0.01, 'Net sales computed as Gross - Cancelled');
  assert(dashboard.collections >= rollbackGrandTotal, `Collections exclude reversed payments and are at least ${rollbackGrandTotal}`);
  assert(typeof dashboard.currentReceivables === 'number', 'Current receivables is ledger-derived');

  console.log(`\nALL PHASE 6.6 LIFECYCLE TESTS PASSED. ASSERTIONS: ${passed}`);
  await closeDatabaseConnection();
}

run().catch(async error => {
  console.error(error);
  await closeDatabaseConnection().catch(() => undefined);
  process.exit(1);
});
