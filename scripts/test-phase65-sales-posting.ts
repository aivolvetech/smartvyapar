import './mock-electron';
import fs from 'fs';
import path from 'path';
import { initializeDatabase } from '../electron/database/database-initializer';
import { closeDatabaseConnection, getDatabaseConnection } from '../electron/database/database-connection';
import { getDatabasePath, getPlainDatabasePath } from '../electron/database/database-paths';
import { WindowsDpapiKeyProvider } from '../electron/security/windows-dpapi-key-provider';
import { ShopRepository } from '../electron/database/repositories/shop.repository';
import { CustomerRepository } from '../electron/database/repositories/customer.repository';
import { CustomerService } from '../electron/services/customer.service';
import { ProductRepository } from '../electron/database/repositories/product.repository';
import { ProductService } from '../electron/services/product.service';
import { UnitOfMeasureRepository } from '../electron/database/repositories/unit-of-measure.repository';
import { TaxRateRepository } from '../electron/database/repositories/tax-rate.repository';
import { ProductBarcodeRepository } from '../electron/database/repositories/product-barcode.repository';
import { SalesService } from '../electron/services/sales.service';
import { InventoryTransactionRepository } from '../electron/database/repositories/inventory-transaction.repository';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`SUCCESS: ${msg}`);
}

async function runTests() {
  console.log('==================================================');
  console.log('SMART VYAPAR - PHASE 6.5 POSTING INTEGRATION TESTS');
  console.log('==================================================\n');

  const keyProvider = new WindowsDpapiKeyProvider();
  const dbPath = getDatabasePath();
  const plainDbPath = getPlainDatabasePath();
  const testDataDir = path.dirname(plainDbPath);
  if (!fs.existsSync(testDataDir)) fs.mkdirSync(testDataDir, { recursive: true });

  await closeDatabaseConnection();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  if (fs.existsSync(plainDbPath)) fs.unlinkSync(plainDbPath);
  await keyProvider.clearKey();

  assert(await initializeDatabase(), 'Database initializes successfully');
  const db = getDatabaseConnection();

  const shopRepo = new ShopRepository();
  const customerRepo = new CustomerRepository();
  const customerService = new CustomerService();
  const productRepo = new ProductRepository();
  const unitRepo = new UnitOfMeasureRepository();
  const taxRepo = new TaxRateRepository();
  const barcodeRepo = new ProductBarcodeRepository();
  const inventoryTxRepo = new InventoryTransactionRepository();
  const salesService = new SalesService();

  // 1. Create Shop with merchantUpiId
  const shop = shopRepo.createShop({
    name: 'POS Posting Test Shop',
    phone: '9888877777',
    address: 'Viman Nagar, Pune, Maharashtra',
    gstNumber: '27AAAAA1111A1Z1',
    merchantUpiId: 'shop@ybl'
  });
  assert(!!shop && shop.merchantUpiId === 'shop@ybl', 'Shop profile created with UPI merchant ID');

  // Seed default walk-in customer
  customerService.ensureWalkInCustomer(shop.id);
  const walkInCust = customerRepo.findWalkIn(shop.id);
  assert(!!walkInCust, 'Walk-in customer initialized');

  // Seed registered customer
  const customer = customerService.createCustomer({
    name: 'Prem Retailer',
    customerType: 'RETAIL',
    customerCode: 'CUST-001',
    phone: '9812345678',
    state: 'Maharashtra',
  });
  assert(!!customer, 'Registered customer created');

  // Setup Standard default PriceBook
  const defaultPb = db.prepare("SELECT * FROM PriceBook WHERE code='DEFAULT'").get() as any;
  assert(!!defaultPb, 'Default PriceBook exists');

  // Create active default StorePriceBook mappings
  db.prepare(`
    INSERT INTO StorePriceBook (id, shopId, priceBookId, priority, effectiveFrom, isActive, createdAt, updatedAt)
    VALUES ('spb-test', ?, ?, 10, '2026-08-01', 1, datetime('now'), datetime('now'))
  `).run(shop.id, defaultPb.id);

  // Setup UOM, Tax, and Products
  let unit = unitRepo.listAll(false).find(u => u.shortName === 'KG');
  if (!unit) {
    unit = unitRepo.create({
      shopId: shop.id,
      name: 'Kilogram',
      shortName: 'KG',
      decimalAllowed: true,
      decimalPlaces: 3,
      isActive: true
    });
  }
  assert(!!unit, 'UOM KG loaded/created');

  let tax = taxRepo.listAll(false).find(t => t.rate === 18);
  if (!tax) {
    tax = taxRepo.create({
      shopId: shop.id,
      name: 'GST 18%',
      rate: 18,
      taxType: 'GST',
      isActive: true
    });
  }
  assert(!!tax, 'Tax rate 18% loaded/created');

  // Product 1: GOODS (track inventory)
  const productService = new ProductService();
  const product1 = await productService.createProduct({
    product: {
      productCode: 'PROD-A',
      sku: 'SKU-A',
      name: 'Basmati Rice Premium',
      productType: 'GOODS',
      hsnSacCode: '1006',
      primaryUnitId: unit.id,
      taxRateId: tax.id,
      purchasePrice: 60,
      trackInventory: true,
      allowNegativeStock: false
    },
    barcodes: [{ barcode: 'BAR-A', isPrimary: true }],
    defaultPrice: { purchasePrice: 60.00, sellingPrice: 100.00, mrp: 120.00 },
    openingBalance: null
  });
  assert(!!product1, 'Product GOODS created');

  // Product 2: SERVICE (no inventory)
  const product2 = await productService.createProduct({
    product: {
      productCode: 'PROD-B',
      sku: 'SKU-B',
      name: 'Home Delivery Service',
      productType: 'SERVICE',
      hsnSacCode: '9968',
      primaryUnitId: unit.id,
      taxRateId: tax.id,
      purchasePrice: 0,
      trackInventory: false,
      allowNegativeStock: false
    },
    barcodes: [{ barcode: 'BAR-B', isPrimary: true }],
    defaultPrice: { purchasePrice: 0.00, sellingPrice: 50.00, mrp: 50.00 },
    openingBalance: null
  });
  assert(!!product2, 'Product SERVICES created');

  // Setup initial stock for Product 1: 10 units
  inventoryTxRepo.create({
    shopId: shop.id,
    productId: product1.id,
    transactionType: 'OPENING',
    quantity: 10.00,
    unitCost: 60.00,
    occurredAt: new Date().toISOString()
  });

  // Check initial stock count
  const stockRow = db.prepare('SELECT SUM(quantity) as q FROM InventoryTransaction WHERE productId = ?').get(product1.id) as { q: number };
  assert(stockRow.q === 10.00, 'Initial stock is 10');

  // Test 1: Empty cart post sale fails
  const draft1 = salesService.createDraftForPOS(shop.id, walkInCust.id);
  console.log("DEBUG DRAFT1:", draft1);
  assert(!!draft1, 'Empty POS Draft created successfully');

  try {
    salesService.postSale(draft1.id, [{ paymentMode: 'CASH', amount: 0 }], draft1.version);
    assert(false, 'Posting empty draft should fail');
  } catch (err: any) {
    console.log("DEBUG EMPTY CART ERROR IS:", err.message);
    assert(err.message === 'EMPTY_CART', 'Fails with EMPTY_CART');
  }

  // Add line items to draft 1:
  // PROD-A: qty = 2, unitPrice = 100, gst = 18%.
  // Taxable = 200. Tax = 36. Grand total = 236.
  const updatedDraft1 = salesService.addDraftLine(draft1.id, {
    productId: product1.id,
    quantity: 2,
    provisionalUnitPrice: 100.00,
    provisionalDiscountType: 'NONE',
    provisionalDiscountValue: 0
  });

  const grandTotal1 = updatedDraft1.cart.grandTotal;
  assert(grandTotal1 === 236, `Calculated grand total ${grandTotal1} is 236`);

  // Test 2: Fails when payments allocated does not match grand total
  try {
    salesService.postSale(updatedDraft1.id, [{ paymentMode: 'CASH', amount: 200.00 }], updatedDraft1.version);
    assert(false, 'Should fail when payment total !== grandTotal');
  } catch (err: any) {
    console.log("DEBUG INVALID ALLOCATION ERROR:", err.message);
    assert(err.message === 'INVALID_PAYMENT_ALLOCATION', 'Fails with INVALID_PAYMENT_ALLOCATION');
  }

  // Test 3: Walk-In cannot use CREDIT payment mode
  try {
    salesService.postSale(updatedDraft1.id, [{ paymentMode: 'CREDIT', amount: 236.00 }], updatedDraft1.version);
    assert(false, 'Walk-In customer cannot purchase on credit');
  } catch (err: any) {
    assert(err.message === 'CREDIT_CUSTOMER_REQUIRED', 'Fails with CREDIT_CUSTOMER_REQUIRED');
  }

  // Test 4: Stale version checkout mismatch fails
  try {
    salesService.postSale(updatedDraft1.id, [{ paymentMode: 'CASH', amount: 236.00 }], updatedDraft1.version + 1);
    assert(false, 'Should fail when version mismatch');
  } catch (err: any) {
    assert(err.message === 'STALE_INVOICE_VERSION', 'Fails with STALE_INVOICE_VERSION');
  }

  // Test 5: UPI QR payment confirmation required
  try {
    salesService.postSale(updatedDraft1.id, [{ paymentMode: 'UPI', amount: 236.00 }], updatedDraft1.version);
    assert(false, 'UPI allocation requires cashier confirmation');
  } catch (err: any) {
    assert(err.message === 'UPI_CONFIRMATION_REQUIRED', 'Fails with UPI_CONFIRMATION_REQUIRED');
  }

  // Test 6: Stale context / confirmation token mismatch fails
  try {
    salesService.postSale(updatedDraft1.id, [{ paymentMode: 'UPI', amount: 236.00 }], updatedDraft1.version, {
      contextToken: 'stale-token',
      upiConfirmed: true,
      confirmedUpiAmount: 200 // mismatched confirmed amount
    });
    assert(false, 'Should fail when UPI confirmed amount mismatches allocation');
  } catch (err: any) {
    assert(err.message === 'UPI_CONFIRMATION_REQUIRED', 'Fails with UPI_CONFIRMATION_REQUIRED under mismatched amount');
  }

  // Test 7: Successful post sale under CASH allocation (Walk-In)
  const detail1 = salesService.postSale(updatedDraft1.id, [{ paymentMode: 'CASH', amount: 236.00 }], updatedDraft1.version);
  assert(detail1.invoice.status === 'POSTED', 'Invoice status updated to POSTED');
  assert(detail1.invoice.paymentStatus === 'PAID', 'Payment status updated to PAID');
  assert(detail1.invoice.invoiceNumber === 'INV-2026-000001', 'Official sequence drawn correctly: INV-2026-000001');

  // Test 7A: Double post / idempotency check
  try {
    salesService.postSale(updatedDraft1.id, [{ paymentMode: 'CASH', amount: 236.00 }], updatedDraft1.version);
    assert(false, 'Should fail to post already posted sale');
  } catch (err: any) {
    assert(err.message === 'SALE_ALREADY_POSTED', 'Double post verification: Fails with SALE_ALREADY_POSTED');
  }

  // Verify inventory stock for Product 1 is now 8.00 (decremented by 2)
  const stockRowAfter = db.prepare('SELECT SUM(quantity) as q FROM InventoryTransaction WHERE productId = ?').get(product1.id) as { q: number };
  assert(stockRowAfter.q === 8.00, 'Inventory decremented correctly from 10 to 8');

  // Verify no customer ledger entries created for Walk-in customer
  const ledgerCountWalkIn = db.prepare('SELECT COUNT(*) as c FROM CustomerLedgerEntry WHERE customerId = ?').get(walkInCust.id) as { c: number };
  assert(ledgerCountWalkIn.c === 0, 'No ledger entry for Walk-In customer');

  // Test 8: Insufficient stock validation
  const draft2 = salesService.createDraftForPOS(shop.id, customer.id);
  
  // Attempt to buy 15 units of PROD-A (stock available is only 8)
  const updatedDraft2 = salesService.addDraftLine(draft2.id, {
    productId: product1.id,
    quantity: 15,
    provisionalUnitPrice: 100.00,
    provisionalDiscountType: 'NONE',
    provisionalDiscountValue: 0
  });

  try {
    salesService.postSale(updatedDraft2.id, [{ paymentMode: 'CASH', amount: updatedDraft2.cart.grandTotal }], updatedDraft2.version);
    assert(false, 'Should fail due to insufficient stock');
  } catch (err: any) {
    assert(err.message === 'INSUFFICIENT_STOCK', 'Fails with INSUFFICIENT_STOCK');
  }

  // Test 8A: Rollback check (verify draft remains status DRAFT)
  const rolledBackDraft = db.prepare("SELECT status FROM SalesInvoice WHERE id = ?").get(draft2.id) as any;
  assert(rolledBackDraft.status === 'DRAFT', 'Rollback verification: Draft status is still DRAFT');

  // Correct quantity to 3 (which is available)
  const lineIdToUpdate = updatedDraft2.cart.lines[0].id;
  const correctedDraft2 = salesService.updateDraftLine(draft2.id, lineIdToUpdate, {
    quantity: 3,
    provisionalUnitPrice: 100.00,
    provisionalDiscountType: 'NONE',
    provisionalDiscountValue: 0
  });

  const grandTotal2 = correctedDraft2.cart.grandTotal;
  assert(grandTotal2 === 354, `Corrected Grand Total: ${grandTotal2} is 354`);

  // Test 9: Posting to registered customer with CREDIT allocation
  const detail2 = salesService.postSale(correctedDraft2.id, [{ paymentMode: 'CREDIT', amount: 354.00 }], correctedDraft2.version);
  assert(detail2.invoice.status === 'POSTED', 'Second invoice posted');
  assert(detail2.invoice.invoiceNumber === 'INV-2026-000002', 'Official sequence drawn correctly: INV-2026-000002');
  assert(detail2.invoice.paymentStatus === 'UNPAID', 'Credit payment leads to paymentStatus UNPAID');

  // Verify registered customer ledger entry: DEBIT of 354
  const ledgers = db.prepare('SELECT * FROM CustomerLedgerEntry WHERE customerId = ? ORDER BY createdAt ASC').all(customer.id) as any[];
  assert(ledgers.length === 1, 'One customer ledger entry created');
  assert(ledgers[0].entryType === 'SALE', 'Entry type is SALE');
  assert(ledgers[0].debitAmount === 354, 'Debited grand total 354');
  assert(ledgers[0].creditAmount === 0, 'No credit amount');
  assert(ledgers[0].referenceNumber === 'INV-2026-000002', 'References INV-2026-000002');

  // Test 10: Mixed payment allocation and partial paid ledger checks
  const draft3 = salesService.createDraftForPOS(shop.id, customer.id);
  
  // Add line delivery service PROD-B (SERVICES): quantity = 1, unitPrice = 50.00, gst = 18%. Grand total = 59.
  const updatedDraft3 = salesService.addDraftLine(draft3.id, {
    productId: product2.id,
    quantity: 1,
    provisionalUnitPrice: 50.00,
    provisionalDiscountType: 'NONE',
    provisionalDiscountValue: 0
  });

  const grandTotal3 = updatedDraft3.cart.grandTotal;
  assert(grandTotal3 === 59, `Service Line Grand Total: ${grandTotal3} is 59`);

  // Mixed Payment: Cash = 10, UPI = 20, Credit = 29.
  const token = 'token-3';
  const detail3 = salesService.postSale(updatedDraft3.id, [
    { paymentMode: 'CASH', amount: 10.00 },
    { paymentMode: 'UPI', amount: 20.00 },
    { paymentMode: 'CREDIT', amount: 29.00 }
  ], updatedDraft3.version, {
    contextToken: token,
    upiConfirmed: true,
    confirmedUpiAmount: 20.00
  });

  assert(detail3.invoice.status === 'POSTED', 'Third invoice posted');
  assert(detail3.invoice.invoiceNumber === 'INV-2026-000003', 'Official sequence drawn correctly: INV-2026-000003');
  assert(detail3.invoice.paymentStatus === 'PARTIALLY_PAID', 'Mixed partial payment leads to paymentStatus PARTIALLY_PAID');
  assert(detail3.invoice.paidAmount === 30.00, 'Paid amount is 30.00 (Cash 10 + UPI 20)');
  assert(detail3.invoice.outstandingAmount === 29.00, 'Outstanding credit amount is 29.00');

  // Verify ledger postings:
  // 1. DEBIT: SALE for 59.
  // 2. CREDIT: RECEIPT for 30.
  const allLedgers = db.prepare("SELECT * FROM CustomerLedgerEntry WHERE referenceNumber = 'INV-2026-000003' ORDER BY entryType ASC").all() as any[];
  assert(allLedgers.length === 2, 'Two ledger entries for mixed payment');
  
  const receiptEntry = allLedgers.find(l => l.entryType === 'RECEIPT');
  const saleEntry = allLedgers.find(l => l.entryType === 'SALE');

  assert(!!receiptEntry && receiptEntry.creditAmount === 30, 'RECEIPT credited 30 (non-credit paid)');
  assert(!!saleEntry && saleEntry.debitAmount === 59, 'SALE debited 59 (grand total)');

  // Verify service line did NOT log any inventory transactions
  const svcTxCount = db.prepare('SELECT COUNT(*) as c FROM InventoryTransaction WHERE productId = ?').get(product2.id) as { c: number };
  assert(svcTxCount.c === 0, 'No inventory logged for SERVICE lines');

  // Test 11: Quick Customer Validations and Creation
  console.log('\nTesting Quick Customer Creation and validations...');
  try {
    customerService.createCustomer({
      name: '',
      phone: '9888877777',
      customerType: 'RETAIL',
      requireUniquePhone: true
    });
    assert(false, 'Should fail with CUSTOMER_NAME_REQUIRED');
  } catch (err: any) {
    assert(err.message === 'CUSTOMER_NAME_REQUIRED', 'Fails with CUSTOMER_NAME_REQUIRED');
  }

  try {
    customerService.createCustomer({
      name: 'Quick Cust Test',
      phone: '',
      customerType: 'RETAIL',
      requireUniquePhone: true
    });
    assert(false, 'Should fail with INVALID_MOBILE');
  } catch (err: any) {
    assert(err.message === 'INVALID_MOBILE', 'Fails with INVALID_MOBILE');
  }

  try {
    customerService.createCustomer({
      name: 'Quick Cust Test',
      phone: '123', // Too short
      customerType: 'RETAIL',
      requireUniquePhone: true
    });
    assert(false, 'Should fail with INVALID_MOBILE for invalid format');
  } catch (err: any) {
    assert(err.message === 'INVALID_MOBILE', 'Fails with INVALID_MOBILE for invalid format');
  }

  try {
    customerService.createCustomer({
      name: 'Duplicate Phone Quick Cust',
      phone: '9812345678', // Same phone as Prem Retailer
      customerType: 'RETAIL',
      requireUniquePhone: true
    });
    assert(false, 'Should fail with CUSTOMER_MOBILE_EXISTS');
  } catch (err: any) {
    assert(err.message === 'CUSTOMER_MOBILE_EXISTS', 'Fails with CUSTOMER_MOBILE_EXISTS');
  }

  const quickCust = customerService.createCustomer({
    name: 'Quick Cust Success',
    phone: '9765432100',
    customerType: 'RETAIL',
    requireUniquePhone: true
  });
  assert(!!quickCust && quickCust.name === 'Quick Cust Success', 'Quick Customer created successfully');

  // Test 12: GST & Discount Calculations
  console.log('\nTesting GST & Discount calculations...');
  const draftDiscount = salesService.createDraftForPOS(shop.id, customer.id);
  const updatedDiscountDraft = salesService.addDraftLine(draftDiscount.id, {
    productId: product1.id,
    quantity: 2,
    provisionalUnitPrice: 100.00,
    provisionalDiscountType: 'PERCENT',
    provisionalDiscountValue: 10 // 10%
  });
  
  const discountedLine = updatedDiscountDraft.cart.lines[0];
  assert(discountedLine.discountAmount === 10, 'Discount amount per unit is 10');
  assert(discountedLine.taxableAmount === 180, 'Line taxable amount is 180');
  assert(discountedLine.lineTotal === 212.4, 'Line total is 212.4');
  assert(updatedDiscountDraft.cart.cgstTotal === 16.20, 'CGST total is 16.20');
  assert(updatedDiscountDraft.cart.sgstTotal === 16.20, 'SGST total is 16.20');
  assert(updatedDiscountDraft.cart.grandTotal === 212, 'Grand total rounded off is 212');

  // Test 13: Save Draft, Pending List, Resume, Delete Draft & Amount discount (qty > 1)
  console.log('\nTesting Save Draft, Pending List, Resume, Delete Draft & Amount discount...');
  const draftTest13 = salesService.createDraftForPOS(shop.id, customer.id);
  const savedTest13 = salesService.saveDraftFromPOS(draftTest13.id, {
    customerId: customer.id,
    invoiceDate: '2026-08-19',
    dueDate: null,
    invoiceDiscountType: 'NONE',
    invoiceDiscountValue: 0,
    notes: 'Test 13 Draft',
    lines: [{
      productId: product1.id,
      quantity: 3,
      provisionalUnitPrice: 100.00,
      provisionalDiscountType: 'AMOUNT',
      provisionalDiscountValue: 50.00
    }]
  });

  assert(savedTest13.status === 'DRAFT', 'Draft saved with status DRAFT');
  assert(savedTest13.cart.lines[0].discountAmount === 50, 'Unit discount is 50');
  assert(savedTest13.cart.lines[0].taxableAmount === 150, 'Line taxable amount is 150 ((100 - 50) * 3)');

  const pendingInvoices = salesService.listHeldBillsForPOS(shop.id);
  const foundDraft = pendingInvoices.find(i => i.id === draftTest13.id);
  assert(!!foundDraft && foundDraft.status === 'DRAFT', 'Saved Draft exists in listHeldBillsForPOS output');
  assert(foundDraft?.lineCount === 1, 'Draft has 1 line');
  assert(foundDraft?.totalQty === 3, 'Draft totalQty is 3');

  const resumedDraft = salesService.getDraftForPOS(draftTest13.id, shop.id);
  assert(resumedDraft.status === 'DRAFT', 'Resumed draft status is DRAFT');
  assert(resumedDraft.cart.lines.length === 1, 'Resumed draft cart has lines');
  assert(resumedDraft.cart.lines[0].quantity === 3, 'Resumed draft lines have correct quantity');
  assert(resumedDraft.version === savedTest13.version, 'Draft version preserved');

  salesService.deleteDraft(draftTest13.id, shop.id);
  const postDeleteInvoices = salesService.listHeldBillsForPOS(shop.id);
  const deletedDraft = postDeleteInvoices.find(i => i.id === draftTest13.id);
  assert(!deletedDraft, 'Draft successfully deleted from pending bills list');

  // Test 14: Negative Stock Policy Integration
  console.log('\nTesting Negative Stock Policies...');
  
  // Set shop settings to Allow Negative Stock Globally = OFF (false)
  shopRepo.updateShop({ allowNegativeStockGlobally: false });
  
  // Create a product with INHERIT policy
  const productInherit = await productService.createProduct({
    product: {
      productCode: 'NEG-INH',
      name: 'Negative Inherit Product',
      primaryUnitId: product1.primaryUnitId,
      taxRateId: product1.taxRateId,
      productType: 'GOODS',
      trackInventory: true,
      allowNegativeStock: false,
      negativeStockPolicy: 'INHERIT'
    },
    barcodes: [],
    defaultPrice: { purchasePrice: 5.00, sellingPrice: 10.00, mrp: 15.00 },
    openingBalance: null
  });
  
  // Verify stock is 0
  const stockInherit = getDatabaseConnection().prepare(`
    SELECT COALESCE(SUM(quantity), 0) AS q FROM InventoryTransaction WHERE productId = ?
  `).get(productInherit.id) as { q: number };
  assert(stockInherit.q === 0, 'Initial stock for NEG-INH is 0');
  
  // Under Shop OFF + Product INHERIT, posting a sale of 1 unit must fail with INSUFFICIENT_STOCK
  try {
    const d1 = salesService.createDraftForPOS(shop.id, customer.id);
    const savedD1 = salesService.saveDraftFromPOS(d1.id, {
      customerId: customer.id,
      invoiceDate: '2026-08-19',
      dueDate: null,
      invoiceDiscountType: 'NONE',
      invoiceDiscountValue: 0,
      notes: 'Test INHERIT BLOCK',
      lines: [{
        productId: productInherit.id,
        quantity: 1,
        provisionalUnitPrice: 10.00,
        provisionalDiscountType: 'NONE',
        provisionalDiscountValue: 0
      }]
    });
    salesService.postSale(d1.id, [{ paymentMode: 'CASH', amount: savedD1.cart.grandTotal }], savedD1.version);
    assert(false, 'Should fail under Shop OFF + Product INHERIT');
  } catch (err: any) {
    assert(err.message === 'INSUFFICIENT_STOCK', 'Blocks negative sale under Shop OFF + Product INHERIT');
  }
  
  // Set shop settings to Allow Negative Stock Globally = ON (true)
  shopRepo.updateShop({ allowNegativeStockGlobally: true });
  
  // Under Shop ON + Product INHERIT, posting must succeed and inventory must go negative
  const d2 = salesService.createDraftForPOS(shop.id, customer.id);
  const savedD2 = salesService.saveDraftFromPOS(d2.id, {
    customerId: customer.id,
    invoiceDate: '2026-08-19',
    dueDate: null,
    invoiceDiscountType: 'NONE',
    invoiceDiscountValue: 0,
    notes: 'Test INHERIT ALLOW',
    lines: [{
      productId: productInherit.id,
      quantity: 1,
      provisionalUnitPrice: 10.00,
      provisionalDiscountType: 'NONE',
      provisionalDiscountValue: 0
    }]
  });
  const posted2 = salesService.postSale(d2.id, [{ paymentMode: 'CASH', amount: savedD2.cart.grandTotal }], savedD2.version);
  assert(posted2.invoice.paymentStatus === 'PAID', 'Sale posted successfully under Shop ON + Product INHERIT');
  
  const stockInherit2 = getDatabaseConnection().prepare(`
    SELECT COALESCE(SUM(quantity), 0) AS q FROM InventoryTransaction WHERE productId = ?
  `).get(productInherit.id) as { q: number };
  assert(stockInherit2.q === -1, 'Stock went negative to -1');

  // Under Shop ON + Product BLOCK, posting must fail
  const productBlock = await productService.createProduct({
    product: {
      productCode: 'NEG-BLK',
      name: 'Negative Block Product',
      primaryUnitId: product1.primaryUnitId,
      taxRateId: product1.taxRateId,
      productType: 'GOODS',
      trackInventory: true,
      allowNegativeStock: false,
      negativeStockPolicy: 'BLOCK'
    },
    barcodes: [],
    defaultPrice: { purchasePrice: 5.00, sellingPrice: 10.00, mrp: 15.00 },
    openingBalance: null
  });
  
  try {
    const d3 = salesService.createDraftForPOS(shop.id, customer.id);
    const savedD3 = salesService.saveDraftFromPOS(d3.id, {
      customerId: customer.id,
      invoiceDate: '2026-08-19',
      dueDate: null,
      invoiceDiscountType: 'NONE',
      invoiceDiscountValue: 0,
      notes: 'Test BLOCK override',
      lines: [{
        productId: productBlock.id,
        quantity: 1,
        provisionalUnitPrice: 10.00,
        provisionalDiscountType: 'NONE',
        provisionalDiscountValue: 0
      }]
    });
    salesService.postSale(d3.id, [{ paymentMode: 'CASH', amount: savedD3.cart.grandTotal }], savedD3.version);
    assert(false, 'Should fail under Shop ON + Product BLOCK');
  } catch (err: any) {
    assert(err.message === 'INSUFFICIENT_STOCK', 'Blocks negative sale under Shop ON + Product BLOCK');
  }

  // Under Shop OFF + Product ALLOW, posting must succeed
  shopRepo.updateShop({ allowNegativeStockGlobally: false });
  const productAllow = await productService.createProduct({
    product: {
      productCode: 'NEG-ALL',
      name: 'Negative Allow Product',
      primaryUnitId: product1.primaryUnitId,
      taxRateId: product1.taxRateId,
      productType: 'GOODS',
      trackInventory: true,
      allowNegativeStock: true,
      negativeStockPolicy: 'ALLOW'
    },
    barcodes: [],
    defaultPrice: { purchasePrice: 5.00, sellingPrice: 10.00, mrp: 15.00 },
    openingBalance: null
  });

  const d4 = salesService.createDraftForPOS(shop.id, customer.id);
  const savedD4 = salesService.saveDraftFromPOS(d4.id, {
    customerId: customer.id,
    invoiceDate: '2026-08-19',
    dueDate: null,
    invoiceDiscountType: 'NONE',
    invoiceDiscountValue: 0,
    notes: 'Test ALLOW override',
    lines: [{
      productId: productAllow.id,
      quantity: 2,
      provisionalUnitPrice: 10.00,
      provisionalDiscountType: 'NONE',
      provisionalDiscountValue: 0
    }]
  });
  const posted4 = salesService.postSale(d4.id, [{ paymentMode: 'CASH', amount: savedD4.cart.grandTotal }], savedD4.version);
  assert(posted4.invoice.paymentStatus === 'PAID', 'Sale posted successfully under Shop OFF + Product ALLOW');
  
  const stockAllow = getDatabaseConnection().prepare(`
    SELECT COALESCE(SUM(quantity), 0) AS q FROM InventoryTransaction WHERE productId = ?
  `).get(productAllow.id) as { q: number };
  assert(stockAllow.q === -2, 'Stock went negative to -2');

  // Test 15: Empty Draft Startup Cleanup
  console.log('\nTesting empty draft startup database cleanup...');
  
  // Insert a mock empty draft
  const emptyDraftId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO SalesInvoice (id, shopId, customerId, invoiceNumber, draftReference, invoiceDate, status, grandTotal, paidAmount, outstandingAmount, createdAt, updatedAt, version)
    VALUES (?, ?, ?, 'MOCK-EMPTY-1', 'DFT-MOCK-EMPTY-1', '2026-08-19', 'DRAFT', 0, 0, 0, '2026-08-19', '2026-08-19', 1)
  `).run(emptyDraftId, shop.id, customer.id);
  
  // Verify it exists
  const checkEmpty = db.prepare("SELECT COUNT(*) as c FROM SalesInvoice WHERE id = ?").get(emptyDraftId) as { c: number };
  assert(checkEmpty.c === 1, 'Empty draft created in DB');

  // Run startup maintenance query
  const cleanResult = db.prepare(`
    DELETE FROM SalesInvoice
    WHERE status = 'DRAFT'
      AND grandTotal = 0
      AND paidAmount = 0
      AND id NOT IN (SELECT DISTINCT salesInvoiceId FROM SalesInvoiceLine WHERE salesInvoiceId IS NOT NULL)
      AND id NOT IN (SELECT DISTINCT salesInvoiceId FROM SalesPayment WHERE salesInvoiceId IS NOT NULL)
      AND id NOT IN (SELECT DISTINCT referenceId FROM CustomerLedgerEntry WHERE referenceId IS NOT NULL)
      AND id NOT IN (SELECT DISTINCT referenceId FROM InventoryTransaction WHERE referenceId IS NOT NULL)
  `).run();
  
  assert(cleanResult.changes >= 1, `Cleaned up ${cleanResult.changes} empty draft records successfully`);
  
  const checkEmptyPost = db.prepare("SELECT COUNT(*) as c FROM SalesInvoice WHERE id = ?").get(emptyDraftId) as { c: number };
  assert(checkEmptyPost.c === 0, 'Empty draft safely removed by cleanup');

  console.log('\n==================================================');
  console.log('ALL PHASE 6.5 POSTING INTEGRATION TESTS PASSED!');
  console.log('==================================================');
  
  await closeDatabaseConnection();
  process.exit(0);
}

runTests().catch(err => {
  console.error('Unhandled failure during integration tests:', err);
  process.exit(1);
});
