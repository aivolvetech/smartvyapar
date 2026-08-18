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
import { UnitOfMeasureRepository } from '../electron/database/repositories/unit-of-measure.repository';
import { TaxRateRepository } from '../electron/database/repositories/tax-rate.repository';
import { ProductBarcodeRepository } from '../electron/database/repositories/product-barcode.repository';
import { SalesService } from '../electron/services/sales.service';
import { SalesInvoiceRepository } from '../electron/database/repositories/sales-invoice.repository';
import { SalesLineRepository } from '../electron/database/repositories/sales-line.repository';
import { DraftSalesInvoiceInput } from '../shared/models/sales';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`SUCCESS: ${msg}`);
}

async function runTests() {
  console.log('==================================================');
  console.log('SMART VYAPAR - SALES DRAFT INTEGRATION TESTS');
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

  // 1. Verify schema tables and constraints
  assert(!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='SalesInvoice'").get(), 'SalesInvoice table exists');
  assert(!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='SalesInvoiceLine'").get(), 'SalesInvoiceLine table exists');
  assert(!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='SalesPayment'").get(), 'SalesPayment table exists');

  const shopRepo = new ShopRepository();
  const customerRepo = new CustomerRepository();
  const customerService = new CustomerService();
  const productRepo = new ProductRepository();
  const unitRepo = new UnitOfMeasureRepository();
  const taxRepo = new TaxRateRepository();
  const barcodeRepo = new ProductBarcodeRepository();
  const salesService = new SalesService();
  const salesInvoiceRepo = new SalesInvoiceRepository();
  const salesLineRepo = new SalesLineRepository();

  // Create Shop
  const shop = shopRepo.createShop({
    name: 'Sales Test Store',
    phone: '9888877777',
    address: 'Viman Nagar, Pune',
    gstNumber: '27AAAAA1111A1Z1',
  });
  assert(!!shop, 'Shop profile created');

  // Seed Walk-In customer
  customerService.ensureWalkInCustomer(shop.id);

  // Create active Customer
  const customerId = 'cust-active-01';
  db.prepare(`
    INSERT INTO Customer (
      id, shopId, customerCode, normalizedCustomerCode, name, normalizedName, customerType,
      isActive, createdAt, updatedAt, version
    ) VALUES (?, ?, 'CUST-0001', 'cust-0001', 'Ramesh Kumar', 'ramesh kumar', 'RETAIL', 1, ?, ?, 1)
  `).run(customerId, shop.id, new Date().toISOString(), new Date().toISOString());

  // Create inactive Customer
  const inactiveCustomerId = 'cust-inactive-02';
  db.prepare(`
    INSERT INTO Customer (
      id, shopId, customerCode, normalizedCustomerCode, name, normalizedName, customerType,
      isActive, createdAt, updatedAt, version
    ) VALUES (?, ?, 'CUST-0002', 'cust-0002', 'Suresh Kumar', 'suresh kumar', 'RETAIL', 0, ?, ?, 1)
  `).run(inactiveCustomerId, shop.id, new Date().toISOString(), new Date().toISOString());

  // Create active Unit
  const unit = unitRepo.findById('uom-box')!;
  const taxId = 'tax-gst-18';

  // Create active Product
  const productId = 'prod-active-01';
  productRepo.createRow({
    id: productId,
    productCode: 'PROD-001',
    name: 'Chocolates Pack',
    primaryUnitId: unit.id,
    taxRateId: taxId,
    productType: 'GOODS',
    trackInventory: true,
    allowNegativeStock: false
  });

  // Create barcode for Product
  db.prepare(`
    INSERT INTO ProductBarcode (id, productId, barcode, barcodeType, isPrimary, isActive, createdAt, updatedAt)
    VALUES ('bar-01', ?, '8901234567890', 'EAN13', 1, 1, ?, ?)
  `).run(productId, new Date().toISOString(), new Date().toISOString());

  // Create inactive Product
  const inactiveProductId = 'prod-inactive-02';
  productRepo.createRow({
    id: inactiveProductId,
    productCode: 'PROD-002',
    name: 'Inactive Box',
    primaryUnitId: unit.id,
    taxRateId: taxId,
    productType: 'GOODS',
    trackInventory: true,
    allowNegativeStock: false
  });
  db.prepare('UPDATE Product SET isActive = 0 WHERE id = ?').run(inactiveProductId);

  console.log('Setup completed successfully. Starting assertions...\n');

  // --- 2. Draft Creation Assertions ---
  // Verify active customer check
  try {
    salesService.createDraft(shop.id, inactiveCustomerId);
    assert(false, 'Should fail to create draft with inactive customer');
  } catch (err: any) {
    assert(err.message.includes('is inactive'), 'Inactive customer correctly rejected');
  }

  // Create valid draft
  const draft1 = salesService.createDraft(shop.id, customerId);
  assert(!!draft1, 'Draft created successfully');
  assert(draft1.status === 'DRAFT', 'Default status is DRAFT');
  assert(draft1.invoiceNumber === null, 'invoiceNumber remains NULL for drafts');
  assert(draft1.draftReference === 'DFT-000001', 'Draft reference sequence generated: DFT-000001');

  // Create second draft to check sequence increment
  const draft2 = salesService.createDraft(shop.id, customerId);
  assert(draft2.draftReference === 'DFT-000002', 'Draft reference sequence increments: DFT-000002');

  // --- 3. Save Draft and Snapshot Assertions ---
  // Reject save with inactive product
  const badInput: DraftSalesInvoiceInput = {
    customerId: customerId,
    invoiceDate: '2026-08-05',
    dueDate: null,
    invoiceDiscountType: 'NONE',
    invoiceDiscountValue: 0,
    notes: 'Bad draft',
    lines: [
      {
        productId: inactiveProductId,
        quantity: 2,
        unitPrice: 100,
        discountType: 'NONE',
        discountValue: 0
      }
    ]
  };

  try {
    salesService.saveDraft(draft1.id, badInput);
    assert(false, 'Should fail to save draft with inactive product');
  } catch (err: any) {
    assert(err.message.includes('is inactive'), 'Inactive product correctly rejected');
  }

  // Reject invalid numeric limits
  const negativeQtyInput: DraftSalesInvoiceInput = {
    customerId: customerId,
    invoiceDate: '2026-08-05',
    dueDate: null,
    invoiceDiscountType: 'NONE',
    invoiceDiscountValue: 0,
    notes: 'Negative Qty',
    lines: [
      {
        productId: productId,
        quantity: -5,
        unitPrice: 100,
        discountType: 'NONE',
        discountValue: 0
      }
    ]
  };
  try {
    salesService.saveDraft(draft1.id, negativeQtyInput);
    assert(false, 'Should fail to save draft with negative quantity');
  } catch (err: any) {
    assert(err.message.includes('Quantity must be greater than zero'), 'Negative quantity check constraint works');
  }

  // Test NaN quantity rejected
  const nanQtyInput: DraftSalesInvoiceInput = {
    customerId: customerId,
    invoiceDate: '2026-08-05',
    dueDate: null,
    invoiceDiscountType: 'NONE',
    invoiceDiscountValue: 0,
    notes: 'NaN Qty',
    lines: [
      {
        productId: productId,
        quantity: NaN,
        unitPrice: 100,
        discountType: 'NONE',
        discountValue: 0
      }
    ]
  };
  try {
    salesService.saveDraft(draft1.id, nanQtyInput);
    assert(false, 'Should fail to save draft with NaN quantity');
  } catch (err: any) {
    assert(err.message.includes('Quantity must be greater than zero'), 'NaN quantity correctly rejected');
  }

  // Test Infinity quantity rejected
  const infQtyInput: DraftSalesInvoiceInput = {
    customerId: customerId,
    invoiceDate: '2026-08-05',
    dueDate: null,
    invoiceDiscountType: 'NONE',
    invoiceDiscountValue: 0,
    notes: 'Infinity Qty',
    lines: [
      {
        productId: productId,
        quantity: Infinity,
        unitPrice: 100,
        discountType: 'NONE',
        discountValue: 0
      }
    ]
  };
  try {
    salesService.saveDraft(draft1.id, infQtyInput);
    assert(false, 'Should fail to save draft with Infinity quantity');
  } catch (err: any) {
    assert(err.message.includes('Quantity must be greater than zero'), 'Infinity quantity correctly rejected');
  }

  // Test negative unitPrice rejected
  const negPriceInput: DraftSalesInvoiceInput = {
    customerId: customerId,
    invoiceDate: '2026-08-05',
    dueDate: null,
    invoiceDiscountType: 'NONE',
    invoiceDiscountValue: 0,
    notes: 'Negative Price',
    lines: [
      {
        productId: productId,
        quantity: 5,
        unitPrice: -10,
        discountType: 'NONE',
        discountValue: 0
      }
    ]
  };
  try {
    salesService.saveDraft(draft1.id, negPriceInput);
    assert(false, 'Should fail to save draft with negative unit price');
  } catch (err: any) {
    assert(err.message.includes('Unit price cannot be negative'), 'Negative unitPrice correctly rejected');
  }

  // Test negative discount rejected
  const negDiscInput: DraftSalesInvoiceInput = {
    customerId: customerId,
    invoiceDate: '2026-08-05',
    dueDate: null,
    invoiceDiscountType: 'NONE',
    invoiceDiscountValue: 0,
    notes: 'Negative Discount',
    lines: [
      {
        productId: productId,
        quantity: 5,
        unitPrice: 100,
        discountType: 'PERCENT',
        discountValue: -5
      }
    ]
  };
  try {
    salesService.saveDraft(draft1.id, negDiscInput);
    assert(false, 'Should fail to save draft with negative discount value');
  } catch (err: any) {
    assert(err.message.includes('Discount value cannot be negative'), 'Negative discount correctly rejected');
  }

  // Save valid draft (10 Chocolates @ Rs 150 each, with 10% line discount)
  const validSaveInput: DraftSalesInvoiceInput = {
    customerId: customerId,
    invoiceDate: '2026-08-05',
    dueDate: '2026-08-20',
    invoiceDiscountType: 'AMOUNT',
    invoiceDiscountValue: 50,
    notes: 'First draft save test',
    lines: [
      {
        productId: productId,
        quantity: 10,
        unitPrice: 150,
        discountType: 'PERCENT',
        discountValue: 10
      }
    ]
  };

  const updatedDraft = salesService.saveDraft(draft1.id, validSaveInput);
  assert(updatedDraft.notes === 'First draft save test', 'Notes saved successfully');
  assert(updatedDraft.dueDate === '2026-08-20', 'DueDate saved successfully');

  // Verify provisional total calculations
  // Chocolates line: 10 * (150 - 10% discount) = 10 * 135 = 1350
  // Invoice Discount = 50
  // Grand Total = 1350 - 50 = 1300
  assert(updatedDraft.subtotal === 1350, `Subtotal calculated: ${updatedDraft.subtotal}`);
  assert(updatedDraft.lineDiscountTotal === 150, `Line discount total calculated: ${updatedDraft.lineDiscountTotal}`);
  assert(updatedDraft.invoiceDiscountTotal === 50, `Invoice discount total calculated: ${updatedDraft.invoiceDiscountTotal}`);
  assert(updatedDraft.grandTotal === 1300, `Grand total calculated: ${updatedDraft.grandTotal}`);

  // Fetch from getDraft to assert main-process snapshot population
  const details = salesService.getDraft(draft1.id);
  assert(details.lines.length === 1, 'Draft has exactly 1 line item');
  const line = details.lines[0];

  assert(line.productId === productId, 'productId maps correctly');
  assert(line.productCodeSnapshot === 'PROD-001', 'productCodeSnapshot copied from DB');
  assert(line.productNameSnapshot === 'Chocolates Pack', 'productNameSnapshot copied from DB');
  assert(line.productTypeSnapshot === 'GOODS', 'productTypeSnapshot copied from DB');
  assert(line.barcodeSnapshot === '8901234567890', 'Primary barcode snapshot retrieved from DB');
  assert(line.unitNameSnapshot === 'BOX', 'UOM shortName snapshot retrieved from DB');
  assert(line.taxCategorySnapshot === 'GST', 'Tax category snapshot retrieved from DB');
  assert(line.taxRateSnapshot === 18, 'Tax rate snapshot retrieved from DB');
  assert(line.cgstRate === 9, 'CGST rate snapshot retrieved from DB');
  assert(line.sgstRate === 9, 'SGST rate snapshot retrieved from DB');
  assert(line.igstRate === 18, 'IGST rate snapshot retrieved from DB');
  assert(line.quantity === 10, 'quantity maps correctly');
  assert(line.unitPrice === 150, 'unitPrice maps correctly');
  assert(line.discountAmount === 15, 'Discount amount per item calculated correctly (provisional)');
  assert(line.lineTotal === 1350, 'Line total calculated correctly (provisional)');

  // --- 4. Hold & Resume State Machine Assertions ---
  // Hold draft
  salesService.holdBill(draft1.id);
  const heldInvoice = salesInvoiceRepo.findById(draft1.id);
  assert(heldInvoice?.status === 'HELD', 'Invoice status transitioned to HELD');
  assert(heldInvoice?.heldAt !== null, 'heldAt timestamp populated');

  // Verify updates are blocked on HELD invoices
  try {
    salesService.saveDraft(draft1.id, validSaveInput);
    assert(false, 'Should block updates on HELD invoices');
  } catch (err: any) {
    assert(err.message.includes('resumed to DRAFT'), 'HELD updates correctly blocked');
  }

  // Resume invoice
  salesService.resumeBill(draft1.id);
  const resumedInvoice = salesInvoiceRepo.findById(draft1.id);
  assert(resumedInvoice?.status === 'DRAFT', 'Invoice status transitioned back to DRAFT');
  assert(resumedInvoice?.heldAt === null, 'heldAt timestamp cleared');

  // --- 5. Deletion & Protection Assertions ---
  // Mock POSTED status to test protections
  db.prepare("UPDATE SalesInvoice SET status = 'POSTED' WHERE id = ?").run(draft1.id);
  try {
    salesService.saveDraft(draft1.id, validSaveInput);
    assert(false, 'Should block save on POSTED status');
  } catch (err: any) {
    assert(err.message.includes('posted or cancelled'), 'POSTED edit block works');
  }

  try {
    salesService.deleteDraft(draft1.id);
    assert(false, 'Should block deletion on POSTED status');
  } catch (err: any) {
    assert(err.message.includes('unposted'), 'POSTED delete block works');
  }

  // Revert back to DRAFT to test deletion cascade
  db.prepare("UPDATE SalesInvoice SET status = 'DRAFT' WHERE id = ?").run(draft1.id);
  salesService.deleteDraft(draft1.id);
  assert(salesInvoiceRepo.findById(draft1.id) === null, 'Draft deleted successfully');
  assert(salesLineRepo.findByInvoiceId(draft1.id).length === 0, 'Cascading deletes removed line items successfully');

  // Assert no side-effects are written (no InventoryTransactions, CustomerLedgerEntries, or SalesPayments)
  const txCount = db.prepare("SELECT count(*) as count FROM InventoryTransaction").get() as { count: number };
  const ledgerCount = db.prepare("SELECT count(*) as count FROM CustomerLedgerEntry").get() as { count: number };
  const payCount = db.prepare("SELECT count(*) as count FROM SalesPayment").get() as { count: number };
  assert(txCount.count === 0, 'No InventoryTransaction entries were created');
  assert(ledgerCount.count === 0, 'No CustomerLedgerEntry entries were created');
  assert(payCount.count === 0, 'No SalesPayment entries were created');

  // --- 6. Persistence across Database Restart Assertions ---
  // Create another draft, save it, close connection, reopen, and retrieve
  const draft3 = salesService.createDraft(shop.id, customerId);
  const persistInput: DraftSalesInvoiceInput = {
    customerId: customerId,
    invoiceDate: '2026-08-05',
    dueDate: '2026-09-01',
    invoiceDiscountType: 'NONE',
    invoiceDiscountValue: 0,
    notes: 'Persistence test draft',
    lines: [
      {
        productId: productId,
        quantity: 5,
        unitPrice: 150,
        discountType: 'NONE',
        discountValue: 0
      }
    ]
  };
  salesService.saveDraft(draft3.id, persistInput);

  console.log('Testing SalesPayment constraints directly in SQLite...');
  // Test amount = 0 rejected
  try {
    db.prepare(`
      INSERT INTO SalesPayment (id, salesInvoiceId, paymentMode, amount, paymentDate, status, createdAt)
      VALUES ('pay-err-01', ?, 'CASH', 0, '2026-08-04', 'CAPTURED', ?)
    `).run(draft3.id, new Date().toISOString());
    assert(false, 'SalesPayment amount = 0 should have failed');
  } catch (err: any) {
    assert(err.message.includes('constraint failed'), 'SalesPayment zero amount rejected successfully');
  }

  // Test negative amount rejected
  try {
    db.prepare(`
      INSERT INTO SalesPayment (id, salesInvoiceId, paymentMode, amount, paymentDate, status, createdAt)
      VALUES ('pay-err-02', ?, 'CASH', -50, '2026-08-04', 'CAPTURED', ?)
    `).run(draft3.id, new Date().toISOString());
    assert(false, 'SalesPayment negative amount should have failed');
  } catch (err: any) {
    assert(err.message.includes('constraint failed'), 'SalesPayment negative amount rejected successfully');
  }

  // Test invalid payment mode rejected
  try {
    db.prepare(`
      INSERT INTO SalesPayment (id, salesInvoiceId, paymentMode, amount, paymentDate, status, createdAt)
      VALUES ('pay-err-03', ?, 'BITCOIN', 100, '2026-08-04', 'CAPTURED', ?)
    `).run(draft3.id, new Date().toISOString());
    assert(false, 'SalesPayment invalid mode should have failed');
  } catch (err: any) {
    assert(err.message.includes('constraint failed'), 'SalesPayment invalid mode rejected successfully');
  }

  // Test invalid payment status rejected
  try {
    db.prepare(`
      INSERT INTO SalesPayment (id, salesInvoiceId, paymentMode, amount, paymentDate, status, createdAt)
      VALUES ('pay-err-04', ?, 'CASH', 100, '2026-08-04', 'PENDING', ?)
    `).run(draft3.id, new Date().toISOString());
    assert(false, 'SalesPayment invalid status should have failed');
  } catch (err: any) {
    assert(err.message.includes('constraint failed'), 'SalesPayment invalid status rejected successfully');
  }

  // Test invalid foreign key rejected
  try {
    db.prepare(`
      INSERT INTO SalesPayment (id, salesInvoiceId, paymentMode, amount, paymentDate, status, createdAt)
      VALUES ('pay-err-05', 'non-existent-invoice', 'CASH', 100, '2026-08-04', 'CAPTURED', ?)
    `).run(new Date().toISOString());
    assert(false, 'SalesPayment invalid FK should have failed');
  } catch (err: any) {
    assert(err.message.toLowerCase().includes('foreign key constraint failed'), 'SalesPayment invalid FK rejected successfully');
  }

  console.log('Testing customer shop-ownership check...');
  // Create shop 2
  const shop2 = shopRepo.createShop({
    name: 'Second Shop',
    phone: '9111122222',
    address: 'Baner, Pune',
    gstNumber: '27BBBBB2222B2Z2'
  });
  // Create customer in shop 2
  const customerShop2Id = 'cust-shop-2';
  db.prepare(`
    INSERT INTO Customer (
      id, shopId, customerCode, normalizedCustomerCode, name, normalizedName, customerType,
      isActive, createdAt, updatedAt, version
    ) VALUES (?, ?, 'CUST-S2-01', 'cust-s2-01', 'Shop2 Customer', 'shop2 customer', 'RETAIL', 1, ?, ?, 1)
  `).run(customerShop2Id, shop2.id, new Date().toISOString(), new Date().toISOString());

  // Attempt to create draft in shop 1 for customer in shop 2
  try {
    salesService.createDraft(shop.id, customerShop2Id);
    assert(false, 'Should block draft creation for customer in wrong shop');
  } catch (err: any) {
    assert(err.message.includes('does not belong to this shop'), 'Cross-shop draft creation blocked successfully');
  }

  // Attempt to save draft in shop 1 with customer in shop 2
  const wrongShopCustomerInput: DraftSalesInvoiceInput = {
    customerId: customerShop2Id,
    invoiceDate: '2026-08-05',
    dueDate: null,
    invoiceDiscountType: 'NONE',
    invoiceDiscountValue: 0,
    notes: 'Wrong shop customer save',
    lines: []
  };
  try {
    salesService.saveDraft(draft3.id, wrongShopCustomerInput);
    assert(false, 'Should block saving draft with wrong shop customer');
  } catch (err: any) {
    assert(err.message.includes('does not belong to this shop'), 'Cross-shop draft saving blocked successfully');
  }

  console.log('Testing retrieval/modification cross-shop boundary checks...');
  // Fetch draft 3 (shop 1) with wrong shop ID (shop 2)
  try {
    salesService.getDraft(draft3.id, shop2.id);
    assert(false, 'Should block draft retrieval for wrong shop context');
  } catch (err: any) {
    assert(err.message.includes('Invoice does not belong to this shop'), 'Cross-shop retrieval blocked successfully');
  }

  try {
    salesService.holdBill(draft3.id, shop2.id);
    assert(false, 'Should block holdBill for wrong shop context');
  } catch (err: any) {
    assert(err.message.includes('Invoice does not belong to this shop'), 'Cross-shop hold bill blocked successfully');
  }

  try {
    salesService.deleteDraft(draft3.id, shop2.id);
    assert(false, 'Should block deleteDraft for wrong shop context');
  } catch (err: any) {
    assert(err.message.includes('Invoice does not belong to this shop'), 'Cross-shop delete bill blocked successfully');
  }

  console.log('Testing atomic draft save rollback...');
  // Valid draft3 currently has 1 line (5 Chocolates @ Rs 150 = Rs 750)
  const badLinesInput: DraftSalesInvoiceInput = {
    customerId: customerId,
    invoiceDate: '2026-08-05',
    dueDate: null,
    invoiceDiscountType: 'NONE',
    invoiceDiscountValue: 0,
    notes: 'Bad lines update',
    lines: [
      {
        productId: productId,
        quantity: 2,
        unitPrice: 150,
        discountType: 'NONE',
        discountValue: 0
      },
      {
        productId: 'non-existent-product',
        quantity: 3,
        unitPrice: 100,
        discountType: 'NONE',
        discountValue: 0
      }
    ]
  };
  try {
    salesService.saveDraft(draft3.id, badLinesInput);
    assert(false, 'Should fail save on non-existent product');
  } catch (err: any) {
    assert(err.message.includes('not found'), 'Invalid product save error raised');
  }

  // Verify everything rolled back to previous state
  const currentDetails = salesService.getDraft(draft3.id);
  assert(currentDetails.lines.length === 1, 'Rollback: Lines count remained 1');
  assert(currentDetails.lines[0].quantity === 5, 'Rollback: Quantity remained 5');
  assert(currentDetails.invoice.notes === 'Persistence test draft', 'Rollback: Header notes remained unchanged');
  assert(currentDetails.invoice.grandTotal === 750, 'Rollback: Header grandTotal remained Rs 750');

  console.log('Simulating database restart...');
  await closeDatabaseConnection();

  // Re-initialize with same file to check persistence
  assert(await initializeDatabase(), 'Database re-opened successfully');
  const detailsPersisted = salesService.getDraft(draft3.id);
  assert(!!detailsPersisted.invoice, 'Draft invoice retrieved after database restart');
  assert(detailsPersisted.invoice.notes === 'Persistence test draft', 'Draft notes persisted');
  assert(detailsPersisted.invoice.grandTotal === 750, 'Draft totals persisted');
  assert(detailsPersisted.lines.length === 1, 'Draft lines count persisted');
  assert(detailsPersisted.lines[0].productNameSnapshot === 'Chocolates Pack', 'Snapshot product name persisted');

  await closeDatabaseConnection();
  console.log('\nALL ASSERTIONS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
