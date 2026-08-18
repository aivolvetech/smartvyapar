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
import { SalesPriceResolutionService } from '../electron/services/sales-price-resolution.service';
import { SalesBarcodeResolutionService } from '../electron/services/sales-barcode-resolution.service';
import { POSProductSearchService } from '../electron/services/pos-product-search.service';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`SUCCESS: ${msg}`);
}

async function runTests() {
  console.log('==================================================');
  console.log('SMART VYAPAR - PHASE 6.4 INTEGRATION TESTS');
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
  
  const salesService = new SalesService();
  const priceResolutionService = new SalesPriceResolutionService();
  const barcodeResolutionService = new SalesBarcodeResolutionService();
  const productSearchService = new POSProductSearchService();

  // 1. Create Shop
  const shop = shopRepo.createShop({
    name: 'POS Test Shop',
    phone: '9888877777',
    address: 'Viman Nagar, Pune',
    gstNumber: '27AAAAA1111A1Z1',
  });
  assert(!!shop, 'Shop profile created');

  // Seed default walk-in customer
  customerService.ensureWalkInCustomer(shop.id);

  // Setup Standard default PriceBook (inserted by product_master migration)
  const defaultPb = db.prepare("SELECT * FROM PriceBook WHERE code='DEFAULT'").get() as any;
  assert(!!defaultPb, 'Default PriceBook exists');

  // Create additional PriceBooks
  const customerPbId = 'pb-customer-01';
  db.prepare(`
    INSERT INTO PriceBook (id, name, code, description, isDefault, isActive, createdAt, updatedAt)
    VALUES (?, 'Customer Price List', 'CUST-PL', 'Price book for premium retail customers', 0, 1, datetime('now'), datetime('now'))
  `).run(customerPbId);

  const shopPbId1 = 'pb-shop-01';
  db.prepare(`
    INSERT INTO PriceBook (id, name, code, description, isDefault, isActive, createdAt, updatedAt)
    VALUES (?, 'Shop Price Book Priority 1', 'SHOP-PB-01', 'Priority 1 price book', 0, 1, datetime('now'), datetime('now'))
  `).run(shopPbId1);

  const shopPbId2 = 'pb-shop-02';
  db.prepare(`
    INSERT INTO PriceBook (id, name, code, description, isDefault, isActive, createdAt, updatedAt)
    VALUES (?, 'Shop Price Book Priority 2', 'SHOP-PB-02', 'Priority 2 price book', 0, 1, datetime('now'), datetime('now'))
  `).run(shopPbId2);

  // 2. Create StorePriceBook mappings
  // priority 1 maps shopPbId1 (lowest priority value wins, priority ASC)
  db.prepare(`
    INSERT INTO StorePriceBook (id, shopId, priceBookId, priority, effectiveFrom, isActive, createdAt, updatedAt)
    VALUES ('spb-01', ?, ?, 10, '2026-08-01', 1, datetime('now'), datetime('now'))
  `).run(shop.id, shopPbId1);

  // priority 2 maps shopPbId2
  db.prepare(`
    INSERT INTO StorePriceBook (id, shopId, priceBookId, priority, effectiveFrom, isActive, createdAt, updatedAt)
    VALUES ('spb-02', ?, ?, 20, '2026-08-01', 1, datetime('now'), datetime('now'))
  `).run(shop.id, shopPbId2);

  // 3. Create Customers
  const walkInCust = db.prepare("SELECT * FROM Customer WHERE isWalkIn = 1").get() as any;
  assert(!!walkInCust, 'Walk-In Customer exists');

  const customerId = 'cust-premium';
  db.prepare(`
    INSERT INTO Customer (id, shopId, customerCode, normalizedCustomerCode, name, normalizedName, customerType, priceBookId, isActive, createdAt, updatedAt, version)
    VALUES (?, ?, 'CUST-01', 'cust-01', 'Premium Client', 'premium client', 'RETAIL', ?, 1, ?, ?, 1)
  `).run(customerId, shop.id, customerPbId, new Date().toISOString(), new Date().toISOString());

  const inactiveCustId = 'cust-inactive';
  db.prepare(`
    INSERT INTO Customer (id, shopId, customerCode, normalizedCustomerCode, name, normalizedName, customerType, isActive, createdAt, updatedAt, version)
    VALUES (?, ?, 'CUST-02', 'cust-02', 'Inactive Client', 'inactive client', 'RETAIL', 0, ?, ?, 1)
  `).run(inactiveCustId, shop.id, new Date().toISOString(), new Date().toISOString());

  // 4. Create Product with Primary Unit and Tax
  const productId = 'prod-choc';
  productRepo.createRow({
    id: productId,
    productCode: 'CHOC001',
    name: 'Dairy Milk Bar',
    primaryUnitId: 'uom-pcs',
    taxRateId: 'tax-gst-18',
    productType: 'GOODS',
    trackInventory: true,
    allowNegativeStock: false
  });

  // Set default Product cache prices
  db.prepare(`
    UPDATE Product SET cachedSellingPrice = 80, cachedMrp = 100, cachedWholesalePrice = 70 WHERE id = ?
  `).run(productId);

  // Barcode
  db.prepare(`
    INSERT INTO ProductBarcode (id, productId, barcode, barcodeType, isPrimary, isActive, createdAt, updatedAt)
    VALUES ('bar-choc-1', ?, '8901234567890', 'EAN13', 1, 1, ?, ?)
  `).run(productId, new Date().toISOString(), new Date().toISOString());

  db.prepare(`
    INSERT INTO ProductBarcode (id, productId, barcode, barcodeType, isPrimary, isActive, createdAt, updatedAt)
    VALUES ('bar-choc-2', ?, '8901234567891', 'EAN13', 0, 1, ?, ?)
  `).run(productId, new Date().toISOString(), new Date().toISOString());

  // Setup product prices in each book
  // 1. Customer Price Book (Price: 65, MRP: 100)
  db.prepare(`
    INSERT INTO ProductPrice (id, productId, priceBookId, purchasePrice, sellingPrice, mrp, effectiveFrom, isActive, createdAt, updatedAt)
    VALUES ('pp-cust', ?, ?, 50, 65, 100, '2026-08-01', 1, ?, ?)
  `).run(productId, customerPbId, new Date().toISOString(), new Date().toISOString());

  // 2. Shop Price Book Priority 1 (Price: 70, MRP: 100)
  db.prepare(`
    INSERT INTO ProductPrice (id, productId, priceBookId, purchasePrice, sellingPrice, mrp, effectiveFrom, isActive, createdAt, updatedAt)
    VALUES ('pp-shop1', ?, ?, 50, 70, 100, '2026-08-01', 1, ?, ?)
  `).run(productId, shopPbId1, new Date().toISOString(), new Date().toISOString());

  // 3. Shop Price Book Priority 2 (Price: 75, MRP: 100)
  db.prepare(`
    INSERT INTO ProductPrice (id, productId, priceBookId, purchasePrice, sellingPrice, mrp, effectiveFrom, isActive, createdAt, updatedAt)
    VALUES ('pp-shop2', ?, ?, 50, 75, 100, '2026-08-01', 1, ?, ?)
  `).run(productId, shopPbId2, new Date().toISOString(), new Date().toISOString());

  // 4. Standard Price Book (Price: 78, MRP: 100)
  db.prepare(`
    INSERT INTO ProductPrice (id, productId, priceBookId, purchasePrice, sellingPrice, mrp, effectiveFrom, isActive, createdAt, updatedAt)
    VALUES ('pp-std', ?, ?, 50, 78, 100, '2026-08-01', 1, ?, ?)
  `).run(productId, defaultPb.id, new Date().toISOString(), new Date().toISOString());


  // ----------------------------------------------------
  // TEST CASE 1: PRICE RESOLUTION HIERARCHY
  // ----------------------------------------------------
  console.log('Running Test Case 1: Price Resolution Chain...');

  // Customer Price Book should match first
  let resolved = priceResolutionService.resolvePrice({
    shopId: shop.id,
    productId,
    customerId,
    draftDate: '2026-08-04'
  });
  assert(resolved.sellingPrice === 65, '1. Resolved Premium Customer Price Book (Price: 65)');
  assert(resolved.priceSource === 'CUSTOMER_PRICE_BOOK', 'Price source matches CUSTOMER_PRICE_BOOK');
  assert(resolved.minimumSellingPrice === null, 'minimumSellingPrice is null');
  assert(resolved.minimumSellingPriceConfigured === false, 'minimumSellingPriceConfigured is false');

  // Customer has inactive PriceBook fallback to Shop PriceBook
  db.prepare("UPDATE PriceBook SET isActive = 0 WHERE id = ?").run(customerPbId);
  resolved = priceResolutionService.resolvePrice({
    shopId: shop.id,
    productId,
    customerId,
    draftDate: '2026-08-04'
  });
  assert(resolved.sellingPrice === 70, '2. Inactive Customer PB falls back to Shop priority 1 (Price: 70)');
  assert(resolved.priceSource === 'SHOP_PRICE_BOOK', 'Price source matches SHOP_PRICE_BOOK');
  assert(resolved.warnings.includes('CUSTOMER_PRICE_BOOK_INACTIVE'), 'Includes CUSTOMER_PRICE_BOOK_INACTIVE warning');

  // Customer Price Book has no ProductPrice row fallback to Shop PriceBook
  db.prepare("UPDATE PriceBook SET isActive = 1 WHERE id = ?").run(customerPbId);
  db.prepare("DELETE FROM ProductPrice WHERE id = 'pp-cust'").run();
  resolved = priceResolutionService.resolvePrice({
    shopId: shop.id,
    productId,
    customerId,
    draftDate: '2026-08-04'
  });
  assert(resolved.sellingPrice === 70, '3. Customer price not found falls back to Shop priority 1 (Price: 70)');
  assert(resolved.priceSource === 'SHOP_PRICE_BOOK', 'Price source matches SHOP_PRICE_BOOK');
  assert(resolved.warnings.includes('CUSTOMER_PRICE_NOT_FOUND'), 'Includes CUSTOMER_PRICE_NOT_FOUND warning');

  // Shop PriceBook priority 1 missing price fallback to Shop PriceBook priority 2
  db.prepare("DELETE FROM ProductPrice WHERE id = 'pp-shop1'").run();
  resolved = priceResolutionService.resolvePrice({
    shopId: shop.id,
    productId,
    customerId,
    draftDate: '2026-08-04'
  });
  assert(resolved.sellingPrice === 75, '4. Shop Priority 1 missing price falls back to Priority 2 (Price: 75)');

  // All Shop PriceBooks missing price fallback to Standard PriceBook
  db.prepare("DELETE FROM ProductPrice WHERE id = 'pp-shop2'").run();
  resolved = priceResolutionService.resolvePrice({
    shopId: shop.id,
    productId,
    customerId,
    draftDate: '2026-08-04'
  });
  assert(resolved.sellingPrice === 78, '5. All Shop PriceBooks missing falls back to Standard (Price: 78)');
  assert(resolved.priceSource === 'STANDARD_PRICE_BOOK', 'Price source matches STANDARD_PRICE_BOOK');

  // Standard missing price fallback to Product cachedSellingPrice
  db.prepare("DELETE FROM ProductPrice WHERE id = 'pp-std'").run();
  resolved = priceResolutionService.resolvePrice({
    shopId: shop.id,
    productId,
    customerId,
    draftDate: '2026-08-04'
  });
  assert(resolved.sellingPrice === 80, '6. Standard missing price falls back to Product Cache (Price: 80)');
  assert(resolved.priceSource === 'PRODUCT_FALLBACK', 'Price source matches PRODUCT_FALLBACK');
  assert(resolved.warnings.includes('FALLBACK_PRICE_USED'), 'Includes FALLBACK_PRICE_USED warning');

  // Zero selling price warning
  db.prepare("UPDATE Product SET cachedSellingPrice = 0 WHERE id = ?").run(productId);
  resolved = priceResolutionService.resolvePrice({
    shopId: shop.id,
    productId,
    customerId,
    draftDate: '2026-08-04'
  });
  assert(resolved.sellingPrice === 0, '7. Zero selling price resolved');
  assert(resolved.warnings.includes('ZERO_SELLING_PRICE'), 'Includes ZERO_SELLING_PRICE warning');


  // ----------------------------------------------------
  // TEST CASE 2: DATE VALIDATIONS AND CONFLICTS
  // ----------------------------------------------------
  console.log('\nRunning Test Case 2: Date Validations & Conflicts...');

  // Setup Standard Price again
  db.prepare(`
    INSERT INTO ProductPrice (id, productId, priceBookId, purchasePrice, sellingPrice, mrp, effectiveFrom, effectiveTo, isActive, createdAt, updatedAt)
    VALUES ('pp-std-valid', ?, ?, 50, 78, 100, '2026-08-01', '2026-08-10', 1, ?, ?)
  `).run(productId, defaultPb.id, new Date().toISOString(), new Date().toISOString());

  // Inactive standard price should not match
  db.prepare("UPDATE ProductPrice SET isActive = 0 WHERE id = 'pp-std-valid'").run();
  try {
    priceResolutionService.resolvePrice({ shopId: shop.id, productId, customerId: walkInCust.id, draftDate: '2026-08-04' });
  } catch (err: any) {
    // If not found in Standard, falls back to product cache which we set to 0. So it will resolve 0.
  }
  db.prepare("UPDATE ProductPrice SET isActive = 1 WHERE id = 'pp-std-valid'").run();

  // Expired Standard PriceBook
  db.prepare("UPDATE PriceBook SET effectiveTo = '2026-08-03' WHERE id = ?").run(defaultPb.id);
  resolved = priceResolutionService.resolvePrice({ shopId: shop.id, productId, customerId: walkInCust.id, draftDate: '2026-08-04' });
  assert(resolved.priceSource === 'PRODUCT_FALLBACK', 'Expired PriceBook bypassed');
  db.prepare("UPDATE PriceBook SET effectiveTo = NULL WHERE id = ?").run(defaultPb.id);

  // Future Standard price
  db.prepare("UPDATE ProductPrice SET effectiveFrom = '2026-08-05' WHERE id = 'pp-std-valid'").run();
  resolved = priceResolutionService.resolvePrice({ shopId: shop.id, productId, customerId: walkInCust.id, draftDate: '2026-08-04' });
  assert(resolved.priceSource === 'PRODUCT_FALLBACK', 'Future product price bypassed');
  db.prepare("UPDATE ProductPrice SET effectiveFrom = '2026-08-01' WHERE id = 'pp-std-valid'").run();

  // Price conflict (2 or more overlapping active prices)
  db.prepare(`
    INSERT INTO ProductPrice (id, productId, priceBookId, purchasePrice, sellingPrice, mrp, effectiveFrom, isActive, createdAt, updatedAt)
    VALUES ('pp-std-conflict', ?, ?, 50, 95, 100, '2026-08-01', 1, ?, ?)
  `).run(productId, defaultPb.id, new Date().toISOString(), new Date().toISOString());

  try {
    priceResolutionService.resolvePrice({ shopId: shop.id, productId, customerId: walkInCust.id, draftDate: '2026-08-04' });
    assert(false, 'Should throw price conflict error');
  } catch (err: any) {
    assert(err.message.includes('PRICE_CONFLICT'), 'Overlapping price conflict correctly detected');
  }
  db.prepare("DELETE FROM ProductPrice WHERE id = 'pp-std-conflict'").run();


  // ----------------------------------------------------
  // TEST CASE 3: BARCODE RESOLUTION
  // ----------------------------------------------------
  console.log('\nRunning Test Case 3: Barcode Resolution...');

  // Primary barcode
  let bRes = barcodeResolutionService.resolveProductByBarcode({ shopId: shop.id, barcode: '8901234567890', customerId: walkInCust.id });
  assert(bRes.productId === productId, 'Primary barcode resolves correct product ID');
  assert(bRes.unitName === 'PCS', 'Primary UOM snapshot loaded');
  assert(bRes.taxCategory === 'GST', 'Tax rate snapshot loaded');
  assert(bRes.sellingPrice === 78, 'Correct resolved selling price');
  assert(bRes.priceSource === 'STANDARD_PRICE_BOOK', 'Correct price source');

  // Secondary barcode
  bRes = barcodeResolutionService.resolveProductByBarcode({ shopId: shop.id, barcode: ' 8901234567891  ', customerId: walkInCust.id });
  assert(bRes.productId === productId, 'Secondary barcode resolved successfully after whitespace trim');

  // Unknown barcode
  try {
    barcodeResolutionService.resolveProductByBarcode({ shopId: shop.id, barcode: '9999999999999' });
    assert(false, 'Should throw for unknown barcode');
  } catch (err: any) {
    assert(err.message.includes('not found'), 'Unknown barcode correctly rejected');
  }

  // Inactive barcode
  db.prepare("UPDATE ProductBarcode SET isActive = 0 WHERE id = 'bar-choc-1'").run();
  try {
    barcodeResolutionService.resolveProductByBarcode({ shopId: shop.id, barcode: '8901234567890' });
    assert(false, 'Should throw for inactive barcode');
  } catch (err: any) {
    assert(err.message.includes('not found'), 'Inactive barcode correctly rejected');
  }
  db.prepare("UPDATE ProductBarcode SET isActive = 1 WHERE id = 'bar-choc-1'").run();


  // ----------------------------------------------------
  // TEST CASE 4: PRODUCT SEARCH
  // ----------------------------------------------------
  console.log('\nRunning Test Case 4: Product Search...');

  // Search by code
  let searchRes = productSearchService.searchPOSProducts({ shopId: shop.id, query: 'CHOC001', customerId: walkInCust.id });
  assert(searchRes.items.length === 1 && searchRes.items[0].productId === productId, 'Search by Product Code works');

  // Search by name
  searchRes = productSearchService.searchPOSProducts({ shopId: shop.id, query: 'dairy', customerId: walkInCust.id });
  assert(searchRes.items.length === 1 && searchRes.items[0].productName === 'Dairy Milk Bar', 'Search by Name works');

  // Search by barcode
  searchRes = productSearchService.searchPOSProducts({ shopId: shop.id, query: '8901234567890', customerId: walkInCust.id });
  assert(searchRes.items.length === 1, 'Search by Barcode works');


  // ----------------------------------------------------
  // TEST CASE 5: CART & DRAFT OPERATIONS
  // ----------------------------------------------------
  console.log('\nRunning Test Case 5: Cart & Draft Operations...');

  // Create draft
  const draft = salesService.createDraftForPOS(shop.id, walkInCust.id);
  assert(!!draft, 'Draft created successfully via createDraftForPOS');
  assert(draft.cart.lines.length === 0, 'New draft has empty cart');

  // Add line item
  let updatedDraft = salesService.addDraftLine(draft.id, {
    productId,
    quantity: 2,
    provisionalUnitPrice: 78,
    provisionalDiscountType: 'NONE',
    provisionalDiscountValue: 0
  });
  assert(updatedDraft.cart.lines.length === 1, 'Line item added successfully');
  assert(updatedDraft.cart.lines[0].quantity === 2, 'Line quantity matches');
  assert(updatedDraft.cart.subtotal === 156, 'Provisional subtotal calculated correctly');
  assert(updatedDraft.cart.grandTotal === 184, 'Provisional grandTotal calculated correctly (with 18% GST = 156 + 28.08 = 184.08 rounded to 184)');

  // Duplicate scan increments quantity
  updatedDraft = salesService.addDraftLine(draft.id, {
    productId,
    quantity: 1,
    provisionalUnitPrice: 78,
    provisionalDiscountType: 'NONE',
    provisionalDiscountValue: 0
  });
  assert(updatedDraft.cart.lines[0].quantity === 3, 'Duplicate item increments quantity instead of adding new line');

  // Update line details
  const lineId = updatedDraft.cart.lines[0].id;
  updatedDraft = salesService.updateDraftLine(draft.id, lineId, {
    productId,
    quantity: 5,
    provisionalUnitPrice: 78,
    provisionalDiscountType: 'PERCENT',
    provisionalDiscountValue: 10
  });
  assert(updatedDraft.cart.lines[0].quantity === 5, 'Quantity updated');
  assert(updatedDraft.cart.lines[0].discountAmount === 7.8, 'Provisional percent discount calculated');

  // Decimal quantity validation rules
  // pcs unit does not allow decimals
  try {
    salesService.updateDraftLine(draft.id, lineId, {
      productId,
      quantity: 5.5,
      provisionalUnitPrice: 78,
      provisionalDiscountType: 'NONE',
      provisionalDiscountValue: 0
    });
    assert(false, 'Should reject decimal quantity');
  } catch (err: any) {
    assert(err.message.includes('allow decimal quantities'), 'Decimal quantity correctly rejected for non-decimal UOM');
  }

  // Remove line item
  updatedDraft = salesService.removeDraftLine(draft.id, lineId);
  assert(updatedDraft.cart.lines.length === 0, 'Line item removed successfully');


  // ----------------------------------------------------
  // TEST CASE 6: CUSTOMER REPRICING & PERSISTENCE
  // ----------------------------------------------------
  console.log('\nRunning Test Case 6: Customer Repricing & Persistence...');

  // Setup Premium price book again
  db.prepare(`
    INSERT INTO ProductPrice (id, productId, priceBookId, purchasePrice, sellingPrice, mrp, effectiveFrom, isActive, createdAt, updatedAt)
    VALUES ('pp-cust-new', ?, ?, 50, 65, 100, '2026-08-01', 1, ?, ?)
  `).run(productId, customerPbId, new Date().toISOString(), new Date().toISOString());

  // Add line to cart
  salesService.addDraftLine(draft.id, {
    productId,
    quantity: 10,
    provisionalUnitPrice: 78,
    provisionalDiscountType: 'NONE',
    provisionalDiscountValue: 0
  });

  // Reprice Cart for Premium Customer
  const repriced = salesService.repriceCartForCustomer(draft.id, customerId);
  assert(repriced.success === true, 'Atomic customer re-pricing succeeded');
  assert(repriced.repricedLines[0].unitPrice === 65, 'Unit price re-resolved to Premium Customer Price Book (Price: 65)');
  assert(repriced.totals.grandTotal === 767, 'New grandTotal matches premium pricing (650 + 117 GST = 767)');

  // Save POS Draft
  const saved = salesService.saveDraftFromPOS(draft.id, {
    customerId,
    invoiceDate: '2026-08-04',
    dueDate: '2026-08-30',
    invoiceDiscountType: 'AMOUNT',
    invoiceDiscountValue: 50,
    notes: 'Premium invoice',
    lines: [
      {
        productId,
        quantity: 10,
        provisionalUnitPrice: 65,
        provisionalDiscountType: 'NONE',
        provisionalDiscountValue: 0
      }
    ]
  });
  assert(saved.notes === 'Premium invoice', 'POS draft saved successfully');
  assert(saved.cart.invoiceDiscountTotal === 50, 'Provisional invoice discount saved');

  // Hold Draft Bill
  salesService.holdBill(draft.id);
  const heldBills = salesService.listHeldBillsForPOS(shop.id);
  assert(heldBills.length === 1 && heldBills[0].id === draft.id, 'Draft successfully HELD and listed');

  // Resume HELD bill
  const resumed = salesService.resumeBillForPOS(draft.id);
  assert(resumed.status === 'DRAFT', 'HELD bill resumed back to DRAFT');
  assert(resumed.cart.lines.length === 1, 'Resumed bill has lines restored');

  // ----------------------------------------------------
  // TEST CASE 7: SECURITY & NO-DOWNSTREAM-EFFECTS
  // ----------------------------------------------------
  console.log('\nRunning Test Case 7: Security & No-Downstream-Effects...');

  // Assert invoiceNumber is NULL
  const savedRow = db.prepare("SELECT * FROM SalesInvoice WHERE id = ?").get(draft.id) as any;
  assert(savedRow.invoiceNumber === null, 'DRAFT invoiceNumber is strictly NULL');

  // Assert no downstream tables created entries
  const txCount = db.prepare("SELECT count(*) as c FROM InventoryTransaction").get() as { c: number };
  const ledgerCount = db.prepare("SELECT count(*) as c FROM CustomerLedgerEntry").get() as { c: number };
  const payCount = db.prepare("SELECT count(*) as c FROM SalesPayment").get() as { c: number };
  assert(txCount.c === 0, 'No InventoryTransaction rows were created');
  assert(ledgerCount.c === 0, 'No CustomerLedgerEntry rows were created');
  assert(payCount.c === 0, 'No SalesPayment rows were created');

  console.log('\n==================================================');
  console.log('ALL PHASE 6.4 BACKEND INTEGRATION TESTS PASSED!');
  console.log('==================================================');
  
  await closeDatabaseConnection();
  process.exit(0);
}

runTests().catch(err => {
  console.error('Integration test suite encountered a fatal error:', err);
  process.exit(1);
});
