import './mock-electron';
import fs from 'fs';
import path from 'path';
import { initializeDatabase } from '../electron/database/database-initializer';
import { closeDatabaseConnection, getDatabaseConnection } from '../electron/database/database-connection';
import { getDatabasePath, getPlainDatabasePath } from '../electron/database/database-paths';
import { WindowsDpapiKeyProvider } from '../electron/security/windows-dpapi-key-provider';
import { ShopRepository } from '../electron/database/repositories/shop.repository';
import { ProductService } from '../electron/services/product.service';
import { InventoryService } from '../electron/services/inventory.service';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`SUCCESS: ${msg}`);
}

async function runTests() {
  console.log('==================================================');
  console.log('SMART VYAPAR - INVENTORY FOUNDATION TESTS');
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

  assert(await initializeDatabase(), 'Database initializes with inventory migration');
  const db = getDatabaseConnection();
  assert(!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='InventoryTransaction'").get(), 'InventoryTransaction table exists');
  assert(!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='InventoryAdjustment'").get(), 'InventoryAdjustment table exists');
  assert(!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='InventoryAdjustmentLine'").get(), 'InventoryAdjustmentLine table exists');

  const shopRepo = new ShopRepository();
  const productService = new ProductService();
  const inventoryService = new InventoryService();

  const shop = shopRepo.createShop({
    name: 'Inventory Test Shop',
    phone: '9000000000',
    address: 'Inventory Lane',
    gstNumber: '07AAAAA1111A1Z1',
  });
  assert(!!shop, 'Existing single Shop context created');

  const product = await productService.createProduct({
    product: {
      productCode: 'INV-A',
      name: 'Inventory Product A',
      primaryUnitId: 'uom-pcs',
      productType: 'GOODS',
      trackInventory: true,
      allowNegativeStock: false,
      minimumStockLevel: 10,
      reorderLevel: 8,
      maximumStockLevel: 30,
      sku: 'INV-A-SKU',
    },
    barcodes: [{ barcode: '700000000001', isPrimary: true }],
    defaultPrice: { purchasePrice: 50, sellingPrice: 70, mrp: 80 },
    openingBalance: { quantity: 12, unitCost: 50 },
  });
  assert(!!product.id, 'Inventory product created with opening balance');

  const openingRows = db.prepare("SELECT count(*) as count FROM InventoryTransaction WHERE productId=? AND transactionType='OPENING'").get(product.id) as { count: number };
  assert(openingRows.count === 1, 'Opening balance posts exactly one OPENING ledger entry');
  assert(inventoryService.getProductStock(product.id).quantityOnHand === 12, 'Opening stock increases current stock');

  await closeDatabaseConnection();
  assert(await initializeDatabase(), 'Database restart succeeds after inventory migration');
  const dbAfterRestart = getDatabaseConnection();
  const openingRowsAfterRestart = dbAfterRestart.prepare("SELECT count(*) as count FROM InventoryTransaction WHERE productId=? AND transactionType='OPENING'").get(product.id) as { count: number };
  assert(openingRowsAfterRestart.count === 1, 'Restart does not duplicate OPENING ledger entry');

  const adjustmentIn = inventoryService.postAdjustment({
    productId: product.id,
    adjustmentType: 'ADJUSTMENT_IN',
    quantity: 5,
    unitCost: 52,
    reason: 'COUNT_GAIN',
  });
  assert(adjustmentIn.quantity === 5, 'Adjustment-in posts positive quantity');
  assert(inventoryService.getProductStock(product.id).quantityOnHand === 17, 'Adjustment-in increases stock');

  const adjustmentOut = inventoryService.postAdjustment({
    productId: product.id,
    adjustmentType: 'ADJUSTMENT_OUT',
    quantity: 2,
    reason: 'COUNT_SHORT',
  });
  assert(adjustmentOut.quantity === -2, 'Adjustment-out posts negative quantity');
  assert(inventoryService.getProductStock(product.id).quantityOnHand === 15, 'Adjustment-out decreases stock');

  inventoryService.postDamage({ productId: product.id, quantity: 1, reason: 'BROKEN' });
  inventoryService.postExpiry({ productId: product.id, quantity: 1, expiryDate: new Date().toISOString().slice(0, 10), reason: 'EXPIRED' });
  inventoryService.postLoss({ productId: product.id, quantity: 1, reason: 'MISSING' });
  assert(inventoryService.getProductStock(product.id).quantityOnHand === 12, 'Damage, expiry, and loss decrease stock');

  let blocked = false;
  try {
    inventoryService.postLoss({ productId: product.id, quantity: 100, reason: 'BLOCK_NEGATIVE' });
  } catch (err: any) {
    blocked = err.message.includes('Insufficient stock');
  }
  assert(blocked, 'Negative stock is blocked when product policy disallows it');

  const reversal = inventoryService.reverseTransaction({ transactionId: adjustmentOut.id, reason: 'COUNT_RECHECK' });
  assert(reversal.quantity === 2, 'Reversal quantity cancels original transaction');
  assert(inventoryService.getProductStock(product.id).quantityOnHand === 14, 'Reversal restores stock');

  let doubleReverseBlocked = false;
  try {
    inventoryService.reverseTransaction({ transactionId: adjustmentOut.id, reason: 'SECOND_REVERSAL' });
  } catch (err: any) {
    doubleReverseBlocked = err.message.includes('already');
  }
  assert(doubleReverseBlocked, 'Double reversal is rejected');

  const serviceProduct = await productService.createProduct({
    product: {
      productCode: 'INV-SVC',
      name: 'Inventory Service',
      primaryUnitId: 'uom-pcs',
      productType: 'SERVICE',
      trackInventory: false,
    },
    barcodes: [],
    defaultPrice: { purchasePrice: 0, sellingPrice: 100, mrp: 100 },
  });
  let serviceRejected = false;
  try {
    inventoryService.postOpeningStock({ productId: serviceProduct.id, quantity: 1, unitCost: 0 });
  } catch (err: any) {
    serviceRejected = err.message.includes('Service products');
  }
  assert(serviceRejected, 'Service product inventory movement is rejected');

  const summary = inventoryService.getInventorySummary({
    search: '700000000001',
    page: 1,
    pageSize: 10,
    sortBy: 'productCode',
    sortDirection: 'ASC',
  });
  assert(summary.items.length === 1 && summary.items[0].productId === product.id, 'Stock list supports exact barcode search');

  const movements = inventoryService.getInventoryMovements({
    productId: product.id,
    page: 1,
    pageSize: 10,
    sortBy: 'occurredAt',
    sortDirection: 'DESC',
  });
  assert(movements.items.length >= 6, 'Movement history returns paginated ledger rows');

  const dashboard = inventoryService.getInventoryDashboardSummary();
  assert(dashboard.totalTrackedProducts >= 1, 'Inventory dashboard summary returns tracked product count');
  assert(dashboard.totalStockQuantity >= 14, 'Inventory dashboard summary derives stock from ledger');

  const fk = dbAfterRestart.prepare('PRAGMA foreign_key_check').all() as any[];
  assert(fk.length === 0, 'Foreign key validation passes');

  await closeDatabaseConnection();
  console.log('\nALL INVENTORY FOUNDATION TESTS PASSED!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
