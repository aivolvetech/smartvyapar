import './mock-electron';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { initializeDatabase, getDatabaseStatus } from '../electron/database/database-initializer';
import { getDatabaseConnection, closeDatabaseConnection } from '../electron/database/database-connection';
import { getDatabasePath, getPlainDatabasePath } from '../electron/database/database-paths';
import { WindowsDpapiKeyProvider } from '../electron/security/windows-dpapi-key-provider';
import { ShopRepository } from '../electron/database/repositories/shop.repository';
import { ProductRepository } from '../electron/database/repositories/product.repository';
import { ProductBarcodeRepository } from '../electron/database/repositories/product-barcode.repository';
import { ProductPriceRepository } from '../electron/database/repositories/product-price.repository';
import { PriceBookRepository } from '../electron/database/repositories/price-book.repository';
import { InventoryOpeningBalanceRepository } from '../electron/database/repositories/inventory-opening-balance.repository';
import { UnitOfMeasureRepository } from '../electron/database/repositories/unit-of-measure.repository';
import { TaxRateRepository } from '../electron/database/repositories/tax-rate.repository';
import { PricingService } from '../electron/services/pricing.service';
import { ProductService } from '../electron/services/product.service';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`SUCCESS: ${msg}`);
}

async function runTests() {
  console.log('==================================================');
  console.log('SMART VYAPAR - PRODUCT MASTER INTEGRATION TESTS');
  console.log('==================================================\n');

  console.log(`ABI/Node version info:`);
  console.log(`Node Version: ${process.version}`);
  console.log(`Electron Version: ${process.versions.electron || 'N/A'}`);
  console.log(`Platform: ${process.platform}\n`);

  const keyProvider = new WindowsDpapiKeyProvider();
  const shopRepo = new ShopRepository();
  const productRepo = new ProductRepository();
  const barcodeRepo = new ProductBarcodeRepository();
  const priceRepo = new ProductPriceRepository();
  const priceBookRepo = new PriceBookRepository();
  const openingRepo = new InventoryOpeningBalanceRepository();
  const uomRepo = new UnitOfMeasureRepository();
  const taxRepo = new TaxRateRepository();

  const pricingService = new PricingService();
  const productService = new ProductService();

  const dbPath = getDatabasePath();
  const plainDbPath = getPlainDatabasePath();

  const testDataDir = path.dirname(plainDbPath);
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }

  // Clear previous runs
  await closeDatabaseConnection();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  if (fs.existsSync(plainDbPath)) fs.unlinkSync(plainDbPath);
  await keyProvider.clearKey();

  // 1. Initialize Database
  console.log('Initializing Database...');
  const initOk = await initializeDatabase();
  assert(initOk, 'initializeDatabase should return true');

  // Verify seeds are present
  const uoms = uomRepo.listAll();
  assert(uoms.length > 0, 'UoM table should be seeded');
  const seededUnitsCount = uoms.length;

  const taxes = taxRepo.listAll();
  assert(taxes.length > 0, 'TaxRate table should be seeded');

  // Run initializer again to test idempotency
  await closeDatabaseConnection();
  const initOk2 = await initializeDatabase();
  assert(initOk2, 'Second initializeDatabase should succeed');
  assert(uomRepo.listAll().length === seededUnitsCount, 'Seed data must remain idempotent (no duplicate seed rows)');

  // Set up Shop
  console.log('\nSetting up Shop...');
  const shop = shopRepo.createShop({
    name: 'Product Test Shop',
    phone: '9876543210',
    address: '123 Main St',
    gstNumber: '07AAAAA1111A1Z1',
  });
  assert(!!shop, 'Shop profile created');

  // Ensure default pricebook assignment
  pricingService.ensureShopDefaultPriceBook(shop.id);
  const defaultBook = priceBookRepo.getDefault();
  assert(defaultBook.code === 'DEFAULT', 'Default PriceBook should resolve');

  const db = getDatabaseConnection();
  const shopAssignment = db.prepare('SELECT * FROM StorePriceBook WHERE shopId=? AND priceBookId=?').get(shop.id, defaultBook.id);
  assert(!!shopAssignment, 'Shop assigned to default PriceBook');

  // 2. Transaction Rollback Tests
  console.log('\nTesting: Product Creation Transaction Rollback...');
  const initialProductCount = db.prepare('SELECT count(*) as count FROM Product').get() as { count: number };

  try {
    // Attempt to create a product with duplicate code (validation error, should fail)
    await productService.createProduct({
      product: {
        productCode: '', // Invalid empty code
        name: 'Failure Prod',
        primaryUnitId: 'uom-pcs',
      },
      barcodes: [{ barcode: 'BC-FAIL-1', isPrimary: true }],
      defaultPrice: { purchasePrice: 10, sellingPrice: 20, mrp: 25 },
    });
    assert(false, 'Should have thrown validation error for empty code');
  } catch (err: any) {
    assert(err.message.includes('code is required'), 'Validation error detected');
  }

  // Verify no rows were added to Product, ProductBarcode, or ProductPrice
  const postFailProductCount = db.prepare('SELECT count(*) as count FROM Product').get() as { count: number };
  const postFailBarcodeCount = db.prepare("SELECT count(*) as count FROM ProductBarcode WHERE barcode='BC-FAIL-1'").get() as { count: number };
  assert(postFailProductCount.count === initialProductCount.count, 'Product count did not change');
  assert(postFailBarcodeCount.count === 0, 'Barcode row was rolled back');

  // 3. Barcodes Rules & Uniqueness
  console.log('\nTesting: Barcode Rules & Uniqueness...');
  const productA = await productService.createProduct({
    product: {
      productCode: 'PROD-A',
      name: 'Product A',
      primaryUnitId: 'uom-pcs',
    },
    barcodes: [
      { barcode: '1111111111', isPrimary: true },
      { barcode: '2222222222', isPrimary: false },
    ],
    defaultPrice: { purchasePrice: 10, sellingPrice: 20, mrp: 25 },
  });
  assert(productA.productCode === 'PROD-A', 'Product A created');

  const barcodesA = barcodeRepo.listByProduct(productA.id);
  assert(barcodesA.length === 2, 'Two barcodes created');
  assert(barcodesA.filter(b => b.isPrimary).length === 1, 'Exactly one primary barcode');

  // Try creating a new product with duplicate barcode
  try {
    await productService.createProduct({
      product: {
        productCode: 'PROD-B',
        name: 'Product B',
        primaryUnitId: 'uom-pcs',
      },
      barcodes: [{ barcode: '1111111111', isPrimary: true }],
      defaultPrice: { purchasePrice: 10, sellingPrice: 20, mrp: 25 },
    });
    assert(false, 'Duplicate barcode check failed');
  } catch (err: any) {
    assert(err.message.includes('already assigned'), 'Duplicate barcode correctly rejected');
  }

  // Update existing product to change primary barcode
  const updatedA = await productService.updateProduct(productA.id, {
    product: {},
    barcodes: [
      { barcode: '1111111111', isPrimary: false },
      { barcode: '2222222222', isPrimary: true },
    ],
  });
  assert(updatedA.barcodes.find(b => b.barcode === '2222222222')?.isPrimary === true, 'Primary barcode successfully swapped');
  assert(updatedA.barcodes.find(b => b.barcode === '1111111111')?.isPrimary === false, 'Previous primary barcode cleared');

  // 4. Product-Type Rules
  console.log('\nTesting: Product-Type Rules (GOODS vs SERVICE)...');
  // SERVICE with opening balance should reject
  try {
    await productService.createProduct({
      product: {
        productCode: 'SERV-1',
        name: 'Service One',
        primaryUnitId: 'uom-pcs',
        productType: 'SERVICE',
        trackInventory: false,
      },
      barcodes: [],
      defaultPrice: { purchasePrice: 0, sellingPrice: 100, mrp: 100 },
      openingBalance: { quantity: 10, unitCost: 0 },
    });
    assert(false, 'SERVICE product with opening balance should have been rejected');
  } catch (err: any) {
    assert(err.message.includes('not allowed for SERVICE'), 'SERVICE opening balance correctly rejected');
  }

  // SERVICE created successfully
  const serv = await productService.createProduct({
    product: {
      productCode: 'SERV-1',
      name: 'Service One',
      primaryUnitId: 'uom-pcs',
      productType: 'SERVICE',
    },
    barcodes: [],
    defaultPrice: { purchasePrice: 0, sellingPrice: 100, mrp: 100 },
  });
  assert(serv.productType === 'SERVICE', 'Service created');
  assert(serv.trackInventory === false, 'Service disables inventory tracking');
  assert(serv.allowNegativeStock === false, 'Service disables negative stock');

  // GOODS without inventory tracking with opening balance should reject
  try {
    await productService.createProduct({
      product: {
        productCode: 'GOODS-NO-TRACK',
        name: 'Goods No Track',
        primaryUnitId: 'uom-pcs',
        productType: 'GOODS',
        trackInventory: false,
      },
      barcodes: [],
      defaultPrice: { purchasePrice: 50, sellingPrice: 100, mrp: 100 },
      openingBalance: { quantity: 10, unitCost: 50 },
    });
    assert(false, 'Goods with trackInventory=false and opening balance should have been rejected');
  } catch (err: any) {
    assert(err.message.includes('only allowed when inventory tracking is enabled'), 'Goods without tracking opening balance correctly rejected');
  }

  // GOODS with valid opening balance
  const goods = await productService.createProduct({
    product: {
      productCode: 'GOODS-1',
      name: 'Goods One',
      primaryUnitId: 'uom-pcs',
      productType: 'GOODS',
      trackInventory: true,
    },
    barcodes: [],
    defaultPrice: { purchasePrice: 50, sellingPrice: 100, mrp: 120 },
    openingBalance: { quantity: 25, unitCost: 45 },
  });
  assert(goods.productType === 'GOODS', 'Goods created');
  const balance = openingRepo.findByProductAndShop(goods.id, shop.id);
  assert(balance !== null && balance.quantity === 25 && balance.unitCost === 45, 'Opening balance record created successfully');

  // 5. Pricing Overlaps
  console.log('\nTesting: PriceBook & ProductPrice Effective-Date Overlaps...');
  // Attempt to insert overlapping price book/product price directly or via service
  try {
    // Create direct overlapping record via service layer
    pricingService.createDefaultPrice(goods.id, {
      purchasePrice: 60,
      sellingPrice: 110,
      mrp: 130,
    });
    assert(false, 'Overlapping active price period should be rejected in service layer');
  } catch (err: any) {
    assert(err.message.includes('Overlapping active price'), 'Overlapping active price correctly rejected');
  }

  // 6. Search & Filters
  console.log('\nTesting: Normalized Search & Pagination...');
  // Exact barcode lookup
  const foundByBc = await productService.getProductByBarcode('2222222222');
  assert(foundByBc !== null && foundByBc.productCode === 'PROD-A', 'Find by barcode successful');

  // Search filter exact Code
  const searchCode = await productService.listProducts({
    search: 'PROD-A', page: 1, pageSize: 10, sortBy: 'name', sortDirection: 'ASC',
  });
  assert(searchCode.items.length === 1 && searchCode.items[0].productCode === 'PROD-A', 'Search by exact code matches');

  // Search filter prefix
  const searchPrefix = await productService.listProducts({
    search: 'Goods', page: 1, pageSize: 10, sortBy: 'name', sortDirection: 'ASC',
  });
  assert(searchPrefix.items.length === 1 && searchPrefix.items[0].name === 'Goods One', 'Prefix search matches');

  // Pagination limit
  await productService.createProduct({
    product: { productCode: 'P-1', name: 'Page Item 1', primaryUnitId: 'uom-pcs' },
    barcodes: [], defaultPrice: { purchasePrice: 5, sellingPrice: 10, mrp: 10 },
  });
  await productService.createProduct({
    product: { productCode: 'P-2', name: 'Page Item 2', primaryUnitId: 'uom-pcs' },
    barcodes: [], defaultPrice: { purchasePrice: 5, sellingPrice: 10, mrp: 10 },
  });

  const pageRes = await productService.listProducts({
    page: 1, pageSize: 2, sortBy: 'productCode', sortDirection: 'ASC',
  });
  assert(pageRes.items.length === 2, 'Page size limit enforced');
  assert(pageRes.pagination.totalItems >= 4, 'Total item count resolved');

  console.log('\nALL INTEGRATION TESTS PASSED!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
