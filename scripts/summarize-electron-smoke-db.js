const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3-multiple-ciphers');
const { Dpapi } = require('@primno/dpapi');

const root = path.resolve(__dirname, '..');
const userDataDir = path.join(root, 'test-data', 'electron-product-smoke', 'user-data');
const keyPath = path.join(userDataDir, 'security', 'database-key.bin');
const dbPath = path.join(userDataDir, 'data', 'smart-vyapar.db');

const encrypted = fs.readFileSync(keyPath);
const key = Buffer.from(Dpapi.unprotectData(encrypted, null, 'CurrentUser')).toString('utf8');
const db = new Database(dbPath);
db.pragma(`key = '${key}'`);
db.pragma('foreign_keys = ON');

try {
  const count = (table) => db.prepare(`SELECT count(*) AS count FROM ${table}`).get().count;
  const product = db.prepare('SELECT id, productCode, name, isActive FROM Product WHERE productCode = ?').get('PKG-PROD-001');
  const price = product ? db.prepare('SELECT sellingPrice, mrp, isActive FROM ProductPrice WHERE productId = ? ORDER BY createdAt DESC LIMIT 1').get(product.id) : null;
  const barcode = product ? db.prepare('SELECT barcode, isPrimary, isActive FROM ProductBarcode WHERE productId = ?').get(product.id) : null;
  const opening = product ? db.prepare('SELECT quantity, unitCost FROM InventoryOpeningBalance WHERE productId = ?').get(product.id) : null;
  const summary = {
    shopCount: count('Shop'),
    unitCount: count('UnitOfMeasure'),
    taxRateCount: count('TaxRate'),
    categoryCount: count('ProductCategory'),
    brandCount: count('Brand'),
    productCount: count('Product'),
    product: product ? {
      productCode: product.productCode,
      name: product.name,
      isActive: Boolean(product.isActive),
    } : null,
    price,
    barcode: barcode ? {
      barcode: barcode.barcode,
      isPrimary: Boolean(barcode.isPrimary),
      isActive: Boolean(barcode.isActive),
    } : null,
    openingBalance: opening,
  };
  process.stdout.write(JSON.stringify(summary));
} finally {
  db.close();
}
