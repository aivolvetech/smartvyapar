const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3-multiple-ciphers');
const { Dpapi } = require('@primno/dpapi');

const root = path.resolve(__dirname, '..');
const userDataDir = path.join(root, 'test-data', 'electron-purchase-smoke', 'user-data');
const keyPath = path.join(userDataDir, 'security', 'database-key.bin');
const dbPath = path.join(userDataDir, 'data', 'smart-vyapar.db');

if (!fs.existsSync(keyPath) || !fs.existsSync(dbPath)) {
  throw new Error('Purchase smoke DB or DPAPI key is missing.');
}

const encryptedKey = fs.readFileSync(keyPath);
const key = Buffer.from(Dpapi.unprotectData(encryptedKey, null, 'CurrentUser')).toString('utf8');
const db = new Database(dbPath, { readonly: true });
db.pragma(`key = '${key}'`);

function count(table) {
  return db.prepare(`SELECT count(*) as count FROM ${table}`).get().count;
}

const supplier = db.prepare("SELECT id, supplierCode, name, openingBalance, openingBalanceType FROM Supplier WHERE supplierCode='SUP-A'").get();
const outstanding = supplier
  ? db.prepare('SELECT COALESCE(SUM(creditAmount - debitAmount), 0) as outstanding FROM SupplierLedgerEntry WHERE supplierId=?').get(supplier.id).outstanding
  : null;
const ledgerEntries = supplier
  ? db.prepare(`
      SELECT entryType, creditAmount, debitAmount, referenceType, referenceNumber
      FROM SupplierLedgerEntry
      WHERE supplierId=?
      ORDER BY occurredAt, createdAt
    `).all(supplier.id)
  : [];

const product = db.prepare("SELECT id, productCode, name FROM Product WHERE productCode='ITEM-A'").get();
const stock = product
  ? db.prepare('SELECT COALESCE(SUM(quantity), 0) as quantityOnHand FROM InventoryTransaction WHERE productId=?').get(product.id).quantityOnHand
  : null;
const inventoryTransactions = product
  ? db.prepare(`
      SELECT transactionType, quantity, unitCost, referenceType, referenceNumber, reasonCode
      FROM InventoryTransaction
      WHERE productId=?
      ORDER BY occurredAt, postedAt
    `).all(product.id)
  : [];

const summary = {
  shopCount: count('Shop'),
  supplierCount: count('Supplier'),
  purchaseInvoiceCount: count('PurchaseInvoice'),
  purchaseInvoiceLineCount: count('PurchaseInvoiceLine'),
  supplierLedgerEntryCount: count('SupplierLedgerEntry'),
  documentSequenceCount: count('DocumentSequence'),
  supplier,
  supplierOutstanding: outstanding,
  ledgerEntries,
  product,
  quantityOnHand: stock,
  inventoryTransactions,
  foreignKeyViolations: db.prepare('PRAGMA foreign_key_check').all().length,
};

db.close();
console.log(JSON.stringify(summary, null, 2));
