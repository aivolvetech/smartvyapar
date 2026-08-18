# Supplier Purchase Test Evidence

Date: 2026-08-02

## Automated Integration Tests

Supplier and Purchase integration test command:

```powershell
npx esbuild scripts/test-supplier-purchase-integration.ts --bundle --platform=node --target=node20 --format=cjs --external:electron --external:better-sqlite3 --external:better-sqlite3-multiple-ciphers --external:@primno/dpapi --outfile=dist-test/test-supplier-purchase-integration.js
cmd /c "set ELECTRON_RUN_AS_NODE=1&&set SMART_VYAPAR_TEST=true&&node_modules\electron\dist\electron.exe dist-test\test-supplier-purchase-integration.js"
```

### Result: PASS

Covered verification scenarios:
- **Database Initialization & Schemas**: Migrations apply chronologically. Supplier, PurchaseInvoice, PurchaseInvoiceLine, SupplierLedgerEntry, and DocumentSequence tables exist.
- **Supplier Master**:
  - Valid creation & code uniqueness check (case-insensitive duplicate check).
  - Validation of GST format, email, phone.
  - Deactivation/Reactivation toggling.
- **Supplier opening balance**: Updates outstanding balance and records a ledger entry.
- **Purchase Draft CRUD**:
  - Sequential purchase number generation (e.g. `PUR-2026-000001`).
  - Draft creation, updates, and deletion.
  - Block drafts from inactive suppliers.
  - Unique supplier invoice numbers block.
- **Calculations Service**:
  - Tax calculation split (Intra-state uses CGST/SGST, Inter-state uses IGST).
  - GST rates look up.
  - Proportional invoice discount allocation logic across lines.
- **Posting Lifecycle**:
  - Authoritative calculation verification.
  - Inventory updates: stock increase for tracked `GOODS`, skip for `SERVICE` items.
  - Supplier payable ledger credit entry.
  - double post block.
  - Product cached purchase price updates.
- **Cancellation Lifecycle**:
  - Requires reason.
  - Reverses stock via reverse transaction.
  - Supplier payable ledger debit entry.
  - double cancellation block.
  - referenced supplier delete protection.
- **Foreign-key Integrity**: DB integrity checks pass.

All primary, product master, inventory, and supplier/purchase integration tests pass successfully.
