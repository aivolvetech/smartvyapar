import './mock-electron';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { initializeDatabase } from '../electron/database/database-initializer';
import { closeDatabaseConnection, getDatabaseConnection } from '../electron/database/database-connection';
import { getDatabasePath, getPlainDatabasePath } from '../electron/database/database-paths';
import { WindowsDpapiKeyProvider } from '../electron/security/windows-dpapi-key-provider';
import { ShopRepository } from '../electron/database/repositories/shop.repository';
import { InventoryService } from '../electron/services/inventory.service';

function measure<T>(name: string, fn: () => T): { name: string; ms: number; result: T } {
  const started = performance.now();
  const result = fn();
  return { name, ms: Number((performance.now() - started).toFixed(2)), result };
}

async function run() {
  const keyProvider = new WindowsDpapiKeyProvider();
  const dbPath = getDatabasePath();
  const plainDbPath = getPlainDatabasePath();
  const testDataDir = path.dirname(plainDbPath);
  if (!fs.existsSync(testDataDir)) fs.mkdirSync(testDataDir, { recursive: true });
  await closeDatabaseConnection();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  if (fs.existsSync(plainDbPath)) fs.unlinkSync(plainDbPath);
  await keyProvider.clearKey();
  await initializeDatabase();

  const db = getDatabaseConnection();
  const shop = new ShopRepository().createShop({ name: 'Inventory Performance Shop' });
  const now = new Date().toISOString();
  const productCount = 20000;
  const transactionCount = 100000;

  const insertProduct = db.prepare(`
    INSERT INTO Product (
      id, productCode, normalizedProductCode, name, normalizedName,
      primaryUnitId, productType, trackInventory, allowNegativeStock,
      minimumStockLevel, reorderLevel, maximumStockLevel,
      isActive, version, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, 'uom-pcs', 'GOODS', 1, 1, 5, 3, 100, 1, 1, ?, ?)
  `);
  const insertTxn = db.prepare(`
    INSERT INTO InventoryTransaction (
      id, shopId, productId, transactionType, quantity, unitCost, totalCost,
      reasonCode, occurredAt, postedAt, createdAt, updatedAt, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PERF', ?, ?, ?, ?, 1)
  `);

  const seedStarted = performance.now();
  db.transaction(() => {
    for (let i = 1; i <= productCount; i++) {
      const id = `perf-prod-${String(i).padStart(5, '0')}`;
      const code = `PERF-${String(i).padStart(5, '0')}`;
      insertProduct.run(id, code, code.toLowerCase(), `Performance Product ${i}`, `performance product ${i}`, now, now);
    }
    for (let i = 1; i <= transactionCount; i++) {
      const productNo = ((i - 1) % productCount) + 1;
      const productId = `perf-prod-${String(productNo).padStart(5, '0')}`;
      const quantity = i % 5 === 0 ? -1 : 3;
      const type = quantity > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
      insertTxn.run(`perf-txn-${String(i).padStart(6, '0')}`, shop.id, productId, type, quantity, 10, Math.abs(quantity) * 10, now, now, now, now);
    }
  })();
  const seedMs = Number((performance.now() - seedStarted).toFixed(2));

  const service = new InventoryService();
  const single = measure('Single Product stock lookup', () => service.getProductStock('perf-prod-00001').quantityOnHand);
  const list = measure('Paginated stock list', () => service.getInventorySummary({
    page: 1,
    pageSize: 50,
    sortBy: 'productCode',
    sortDirection: 'ASC',
    isActive: true,
  }).items.length);
  const movements = measure('Movement history page', () => service.getInventoryMovements({
    productId: 'perf-prod-00001',
    page: 1,
    pageSize: 50,
    sortBy: 'occurredAt',
    sortDirection: 'DESC',
  }).items.length);
  const dashboard = measure('Dashboard summary', () => service.getInventoryDashboardSummary().totalTrackedProducts);

  const evidence = {
    capturedAt: new Date().toISOString(),
    productCount,
    transactionCount,
    seedMs,
    measurements: [
      { name: single.name, ms: single.ms, targetMs: 100 },
      { name: list.name, ms: list.ms, targetMs: 250 },
      { name: movements.name, ms: movements.ms, targetMs: 250 },
      { name: dashboard.name, ms: dashboard.ms, targetMs: 300 },
    ],
    sampleResults: {
      singleStock: single.result,
      listItems: list.result,
      movementItems: movements.result,
      trackedProducts: dashboard.result,
    },
  };

  fs.mkdirSync(path.join(process.cwd(), 'docs', 'evidence', 'inventory-foundation'), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), 'docs', 'evidence', 'inventory-foundation', 'inventory-performance.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  await closeDatabaseConnection();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

