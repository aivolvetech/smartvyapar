const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3-multiple-ciphers');
const { Dpapi } = require('@primno/dpapi');

const root = path.resolve(__dirname, '..');
const userDataDir = path.join(root, 'test-data', 'electron-inventory-smoke', 'user-data');
const keyPath = path.join(userDataDir, 'security', 'database-key.bin');
const dbPath = path.join(userDataDir, 'data', 'smart-vyapar.db');

if (!fs.existsSync(keyPath) || !fs.existsSync(dbPath)) {
  throw new Error('Inventory smoke DB or DPAPI key is missing.');
}

const encryptedKey = fs.readFileSync(keyPath);
const key = Buffer.from(Dpapi.unprotectData(encryptedKey, null, 'CurrentUser')).toString('utf8');
const db = new Database(dbPath, { readonly: true });
db.pragma(`key = '${key}'`);

function count(table) {
  return db.prepare(`SELECT count(*) as count FROM ${table}`).get().count;
}

const product = db.prepare("SELECT id, productCode, name FROM Product WHERE productCode='INV-SMOKE-001'").get();
const stock = product
  ? db.prepare('SELECT COALESCE(SUM(quantity), 0) as quantityOnHand FROM InventoryTransaction WHERE productId=?').get(product.id)
  : null;
const movements = product
  ? db.prepare(`
      SELECT transactionType, quantity, unitCost, reasonCode
      FROM InventoryTransaction
      WHERE productId=?
      ORDER BY occurredAt, postedAt
    `).all(product.id)
  : [];

const summary = {
  shopCount: count('Shop'),
  productCount: count('Product'),
  openingBalanceCount: count('InventoryOpeningBalance'),
  inventoryTransactionCount: count('InventoryTransaction'),
  inventoryAdjustmentCount: count('InventoryAdjustment'),
  product,
  quantityOnHand: stock?.quantityOnHand ?? null,
  movements,
  foreignKeyViolations: db.prepare('PRAGMA foreign_key_check').all().length,
};

db.close();
console.log(JSON.stringify(summary, null, 2));
