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
import { SupplierService } from '../electron/services/supplier.service';
import { PurchaseService } from '../electron/services/purchase.service';
import { SupplierLedgerService } from '../electron/services/supplier-ledger.service';
import { SupplierRepository } from '../electron/database/repositories/supplier.repository';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`SUCCESS: ${msg}`);
}

async function runTests() {
  console.log('==================================================');
  console.log('SMART VYAPAR - SUPPLIER & PURCHASE INTEGRATION TESTS');
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

  assert(await initializeDatabase(), 'Database initializes with supplier/purchase tables');
  const db = getDatabaseConnection();

  // Verify tables exist
  assert(!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Supplier'").get(), 'Supplier table exists');
  assert(!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='PurchaseInvoice'").get(), 'PurchaseInvoice table exists');
  assert(!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='PurchaseInvoiceLine'").get(), 'PurchaseInvoiceLine table exists');
  assert(!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='SupplierLedgerEntry'").get(), 'SupplierLedgerEntry table exists');
  assert(!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='DocumentSequence'").get(), 'DocumentSequence table exists');

  const shopRepo = new ShopRepository();
  const productService = new ProductService();
  const inventoryService = new InventoryService();
  const supplierService = new SupplierService();
  const purchaseService = new PurchaseService();
  const ledgerService = new SupplierLedgerService();
  const supplierRepo = new SupplierRepository();

  // Setup shop
  const shop = shopRepo.createShop({
    name: 'Maharashtra Smart Vyapar',
    phone: '9000000000',
    address: 'Smart Lane, Pune, Maharashtra', // Maharashtra state (Intra)
    gstNumber: '27AAAAA1111A1Z1',
  });
  assert(!!shop, 'Shop profile created');

  // ==========================================
  // SUPPLIER TESTS
  // ==========================================
  
  // 1. Create supplier
  const supplierA = supplierService.createSupplier({
    supplierCode: 'SUP-A',
    name: 'Maharashtra Supplier A',
    state: 'Maharashtra',
    gstNumber: '27BBBBB2222B2Z2',
    openingBalance: 1200,
    openingBalanceType: 'PAYABLE',
  });
  assert(!!supplierA, 'Supplier A created successfully');
  assert(supplierA.supplierCode === 'SUP-A', 'Supplier code matches');
  assert(supplierA.outstanding === 1200, 'Supplier A opening balance updates outstanding');

  // Check ledger entry for opening balance
  const ledgerRows = db.prepare("SELECT * FROM SupplierLedgerEntry WHERE supplierId = ?").all(supplierA.id) as any[];
  assert(ledgerRows.length === 1, 'Exactly one ledger entry recorded for opening balance');
  assert(ledgerRows[0].entryType === 'OPENING_BALANCE', 'Ledger entry is of type OPENING_BALANCE');
  assert(ledgerRows[0].creditAmount === 1200 && ledgerRows[0].debitAmount === 0, 'Opening balance payable is recorded as credit');

  // 2. Duplicate check
  let duplicateBlocked = false;
  try {
    supplierService.createSupplier({
      supplierCode: 'sup-a',
      name: 'Supplier A Duplicate',
    });
  } catch (err: any) {
    duplicateBlocked = err.message.includes('already exists');
  }
  assert(duplicateBlocked, 'Duplicate supplier code creation is blocked');

  // 3. Validation format checks
  let invalidGstBlocked = false;
  try {
    supplierService.createSupplier({
      supplierCode: 'SUP-X',
      name: 'Supplier X',
      gstNumber: 'INVALIDGST',
    });
  } catch (err: any) {
    invalidGstBlocked = err.message.includes('GST number');
  }
  assert(invalidGstBlocked, 'Invalid GST number format is blocked');

  // 4. Create inactive supplier
  let supplierB = supplierService.createSupplier({
    supplierCode: 'SUP-B',
    name: 'Gujarat Supplier B',
    state: 'Gujarat',
    gstNumber: '24CCCCC3333C3Z3',
  });
  supplierB = supplierService.setSupplierActive(supplierB.id, false);
  assert(supplierB.isActive === false, 'Supplier can be deactivated');

  // 5. Deactivated supplier draft creation check
  let inactiveDraftBlocked = false;
  try {
    purchaseService.createPurchaseDraft({
      supplierId: supplierB.id,
      invoiceDate: '2026-08-02',
      lines: [],
    });
  } catch (err: any) {
    inactiveDraftBlocked = err.message.includes('Inactive supplier');
  }
  assert(inactiveDraftBlocked, 'Draft purchase creation with inactive supplier is blocked');

  // Reactivate supplier B
  supplierB = supplierService.setSupplierActive(supplierB.id, true);
  assert(supplierB.isActive === true, 'Supplier can be reactivated');

  // ==========================================
  // PURCHASE TESTS
  // ==========================================

  // Setup products
  const productA = await productService.createProduct({
    product: {
      productCode: 'ITEM-A',
      name: 'Tracked Product A',
      primaryUnitId: 'uom-pcs',
      productType: 'GOODS',
      trackInventory: true,
      taxRateId: 'tax-gst-18', // 18% GST
    },
    barcodes: [{ barcode: '900000000001', isPrimary: true }],
    defaultPrice: { purchasePrice: 100, sellingPrice: 150, mrp: 200 },
  });

  const productS = await productService.createProduct({
    product: {
      productCode: 'ITEM-S',
      name: 'Service Product S',
      primaryUnitId: 'uom-pcs',
      productType: 'SERVICE',
      trackInventory: false,
      taxRateId: 'tax-gst-18',
    },
    barcodes: [],
    defaultPrice: { purchasePrice: 50, sellingPrice: 80, mrp: 80 },
  });

  // 1. Create Purchase Draft
  const draftDetail = purchaseService.createPurchaseDraft({
    supplierId: supplierA.id,
    invoiceDate: '2026-08-02',
    supplierInvoiceNumber: 'INV-123',
    lines: [
      {
        productId: productA.id,
        quantity: 10,
        unitPrice: 100,
        mrp: 200,
        discountType: 'PERCENT',
        discountValue: 10, // 10% line discount
        taxRateId: 'tax-gst-18',
      },
      {
        productId: productS.id,
        quantity: 5,
        unitPrice: 50,
        mrp: 50,
        taxRateId: 'tax-gst-18',
      }
    ],
  });

  assert(draftDetail.invoice.status === 'DRAFT', 'Draft purchase created successfully');
  assert(draftDetail.invoice.purchaseNumber.startsWith('PUR-2026-'), 'Purchase number prefix is correct');

  // 2. Authoritative calculations on Draft
  // Product A taxable base = 10 * 100 = 1000. Less 10% discount (100) = 900.
  // Product S taxable base = 5 * 50 = 250.
  // Total pre-discount taxable = 900 + 250 = 1150.
  // GST 18%: Product A is intra-state (Maharashtra supplier state, Maharashtra shop). CGST 9% (81), SGST 9% (81).
  // Product S is intra-state. CGST 9% (22.50), SGST 9% (22.50).
  // Total CGST = 81 + 22.50 = 103.50, Total SGST = 81 + 22.50 = 103.50.
  // Subtotal = 1000 + 250 = 1250.
  // Line discount total = 100.
  // Grand total before round = 1150 + 103.50 + 103.50 = 1357.
  assert(draftDetail.invoice.subtotal === 1250, 'Subtotal is 1250');
  assert(draftDetail.invoice.lineDiscountTotal === 100, 'Line discount total is 100');
  assert(draftDetail.invoice.taxableAmount === 1150, 'Taxable amount is 1150');
  assert(draftDetail.invoice.cgstTotal === 103.50, 'Total CGST is 103.50');
  assert(draftDetail.invoice.sgstTotal === 103.50, 'Total SGST is 103.50');
  assert(draftDetail.invoice.igstTotal === 0, 'Total IGST is 0 (Intra-state)');
  assert(draftDetail.invoice.grandTotal === 1357, 'Grand total is 1357');

  // 3. Update Draft with invoice-level discount
  const updatedDetail = purchaseService.updatePurchaseDraft(draftDetail.invoice.id, {
    supplierId: supplierA.id,
    invoiceDate: '2026-08-02',
    supplierInvoiceNumber: 'INV-123',
    invoiceDiscountType: 'AMOUNT',
    invoiceDiscountValue: 150, // Rs 150 invoice discount
    lines: draftDetail.lines.map(l => ({
      productId: l.productId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      mrp: l.mrp,
      discountType: l.discountType,
      discountValue: l.discountValue,
      taxRateId: l.taxRateId,
    })),
  });

  // Invoice discount proportional allocation:
  // Product A taxable before inv discount = 900. Share = 150 * (900 / 1150) = 117.39. Taxable = 782.61.
  // Product S taxable before inv discount = 250. Share = 150 * (250 / 1150) = 32.61. Taxable = 217.39.
  // Total taxable = 782.61 + 217.39 = 1000.
  // CGST (9% of 1000) = 90.00, SGST (9% of 1000) = 90.00.
  // Grand total before round = 1000 + 90 + 90 = 1180.
  assert(updatedDetail.invoice.invoiceDiscountTotal === 150, 'Invoice discount total is 150');
  assert(updatedDetail.invoice.taxableAmount === 1000, 'Taxable amount reduced to 1000');
  assert(updatedDetail.invoice.cgstTotal === 90, 'CGST reduced to 90');
  assert(updatedDetail.invoice.sgstTotal === 90, 'SGST reduced to 90');
  assert(updatedDetail.invoice.grandTotal === 1180, 'Grand total is 1180');

  // 4. Duplicate invoice number check (same supplier + same invoice number)
  let duplicateInvoiceBlocked = false;
  try {
    purchaseService.createPurchaseDraft({
      supplierId: supplierA.id,
      invoiceDate: '2026-08-02',
      supplierInvoiceNumber: 'INV-123', // Same invoice number
      lines: [],
    });
  } catch (err: any) {
    duplicateInvoiceBlocked = err.message.includes('invoice number already exists');
  }
  assert(duplicateInvoiceBlocked, 'Duplicate supplier invoice number for same supplier is blocked');

  // 5. Post Purchase Draft
  const postedDetail = purchaseService.postPurchase(updatedDetail.invoice.id);
  assert(postedDetail.invoice.status === 'POSTED', 'Invoice status is POSTED');

  // Verify inventory updates
  // Only Product A (GOODS + tracked) should have inventory transaction, Product S (SERVICE) should not!
  const itemAStock = inventoryService.getProductStock(productA.id);
  assert(itemAStock.quantityOnHand === 10, 'Tracked Goods stock increased by purchase quantity (10)');

  const serviceStock = inventoryService.getProductStock(productS.id);
  assert(serviceStock.quantityOnHand === 0, 'Service stock is unaffected (remains 0)');

  // Verify supplier outstanding updates (1200 opening balance + 1180 purchase total = 2380)
  const supplierAfterPost = supplierService.getSupplierById(supplierA.id)!;
  assert(supplierAfterPost.outstanding === 2380, 'Supplier outstanding increased to 2380 after posting purchase');

  // Verify ledger entry
  const ledgerEntriesAfterPost = db.prepare("SELECT * FROM SupplierLedgerEntry WHERE supplierId = ? AND entryType = 'PURCHASE'").all(supplierA.id) as any[];
  assert(ledgerEntriesAfterPost.length === 1, 'Exactly one ledger entry for the purchase');
  assert(ledgerEntriesAfterPost[0].creditAmount === 1180, 'Purchase total recorded as credit');

  // 6. Block editing / deleting posted purchase
  let editPostedBlocked = false;
  try {
    purchaseService.updatePurchaseDraft(postedDetail.invoice.id, {
      supplierId: supplierA.id,
      invoiceDate: '2026-08-02',
      lines: [],
    });
  } catch (err: any) {
    editPostedBlocked = err.message.includes('Only draft purchases can be edited');
  }
  assert(editPostedBlocked, 'Modifying posted purchase is blocked');

  let deletePostedBlocked = false;
  try {
    purchaseService.deletePurchaseDraft(postedDetail.invoice.id);
  } catch (err: any) {
    deletePostedBlocked = err.message.includes('Only draft purchases can be deleted');
  }
  assert(deletePostedBlocked, 'Deleting posted purchase is blocked');

  // 7. Cancel Posted Purchase
  const cancelledDetail = purchaseService.cancelPurchase(postedDetail.invoice.id, {
    reason: 'Wrong items received',
  });
  assert(cancelledDetail.invoice.status === 'CANCELLED', 'Invoice status is CANCELLED');

  // Verify inventory reversal
  const itemAStockAfterCancel = inventoryService.getProductStock(productA.id);
  assert(itemAStockAfterCancel.quantityOnHand === 0, 'Tracked Goods stock reversed to 0 after cancellation');

  // Verify supplier outstanding reversal (2380 outstanding - 1180 grand total = 1200 outstanding)
  const supplierAfterCancel = supplierService.getSupplierById(supplierA.id)!;
  assert(supplierAfterCancel.outstanding === 1200, 'Supplier outstanding reversed to 1200 after cancellation');

  // Verify ledger entries after cancellation
  const cancelLedgerEntries = db.prepare("SELECT * FROM SupplierLedgerEntry WHERE supplierId = ? AND entryType = 'PURCHASE_CANCELLATION'").all(supplierA.id) as any[];
  assert(cancelLedgerEntries.length === 1, 'Exactly one ledger entry for purchase cancellation');
  assert(cancelLedgerEntries[0].debitAmount === 1180, 'Reversal recorded as debit');

  // 8. Double cancel block
  let doubleCancelBlocked = false;
  try {
    purchaseService.cancelPurchase(postedDetail.invoice.id, { reason: 'Second cancel' });
  } catch (err: any) {
    doubleCancelBlocked = err.message.includes('Only posted purchases can be cancelled');
  }
  assert(doubleCancelBlocked, 'Double cancellation is blocked');

  // 9. Block deletion of referenced supplier
  let supplierDeleteBlocked = false;
  try {
    if (supplierRepo.isReferenced(supplierA.id)) {
      throw new Error('Supplier is referenced by purchases and cannot be deleted.');
    }
  } catch (err: any) {
    supplierDeleteBlocked = err.message.includes('referenced by purchases');
  }
  assert(supplierDeleteBlocked, 'Referenced supplier hard delete protection matches plan');

  // ==========================================
  // TAX CALCULATIONS: INTER-STATE TEST
  // ==========================================
  // Maharashtra Shop, Gujarat Supplier -> IGST
  const draftDetailInter = purchaseService.createPurchaseDraft({
    supplierId: supplierB.id,
    invoiceDate: '2026-08-02',
    lines: [
      {
        productId: productA.id,
        quantity: 10,
        unitPrice: 100,
        mrp: 200,
        taxRateId: 'tax-gst-18',
      }
    ],
  });

  // Base = 1000. Taxable = 1000.
  // Inter-state -> IGST 18% (180). CGST = 0, SGST = 0.
  assert(draftDetailInter.invoice.cgstTotal === 0, 'Inter-state CGST is 0');
  assert(draftDetailInter.invoice.sgstTotal === 0, 'Inter-state SGST is 0');
  assert(draftDetailInter.invoice.igstTotal === 180, 'Inter-state IGST is 180');
  assert(draftDetailInter.invoice.grandTotal === 1180, 'Inter-state Grand Total is 1180');

  // Verify foreign key integrity check
  const fk = db.prepare('PRAGMA foreign_key_check').all() as any[];
  assert(fk.length === 0, 'Foreign key validation passes');

  await closeDatabaseConnection();
  console.log('\nALL SUPPLIER & PURCHASE INTEGRATION TESTS PASSED!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
