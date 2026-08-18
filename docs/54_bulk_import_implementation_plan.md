# 54. Bulk Import Implementation Plan

This document defines the technical plan to implement a secure, offline-first, transactional Bulk Data Import Engine for Smart Vyapar. It provides the implementation details for Unit of Measure, Tax Rate, Price Book, Product Master, Barcodes, Pricing, Opening Stock, Suppliers, and Supplier Opening Balances.

## 1. Existing Architecture & Audit Findings
- **Data Models & Schema**:
  - `UnitOfMeasure`: Stores name, shortName, decimalAllowed, decimalPlaces. Seeded with standard items. shortName is unique.
  - `TaxRate`: Stores tax codes, cgst/sgst/igst rates. cgst/sgst is used for intra-state split; igst for inter-state.
  - `PriceBook`: Standard price book maps default prices.
  - `Product`: GOODS vs SERVICE. GOODS can track inventory and allow opening balances; SERVICE cannot.
  - `ProductBarcode`: Linked to products. Barcodes must be globally unique.
  - `ProductPrice`: Standard selling/purchase/mrp list.
  - `InventoryOpeningBalance`: Opening stock quantity and cost, linked to `Product`.
  - `Supplier`: Code, name, contact info, state (for tax split), opening balances.
  - `SupplierLedgerEntry`: Immutable ledger transaction.
- **Service Boundaries**:
  - `ProductService.createProduct` and `updateProduct` encapsulate strict business logic.
  - `InventoryService.postOpeningStock` posts inventory stock changes transactionally.
  - `SupplierService.createSupplier` and `SupplierLedgerService.recordOpening` encapsulate supplier opening balances.
- **IPC & Preload Security**:
  - Preload exposes narrow endpoints. IPC invokes validate the sender frame origin using `isTrustedSender` helper. No raw file-system, db handles, or secrets are exposed.

## 2. Proposed Changes

### Database Migration
#### [NEW] [migration.sql](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/prisma/migrations/20260803120000_bulk_import_foundation/migration.sql)
We will add three new tables to log bulk imports:
- `ImportJob`: Tracks imports, statuses (`CREATED`, `FILE_PARSED`, `VALIDATED`, `READY`, `PROCESSING`, `COMPLETED`, `COMPLETED_WITH_ERRORS`, `FAILED`, `CANCELLED`), row counts, and error summaries.
- `ImportJobRow`: Logs individual row status (`PENDING`, `VALID`, `INVALID`, `DUPLICATE_IN_FILE`, `DUPLICATE_IN_DATABASE`, `INSERTED`, `UPDATED`, `SKIPPED`, `FAILED`), data mappings, actions, and errors.
- `ImportTemplate`: Stores templates definitions and versions.

### Services & Parsers
#### [NEW] [bulk-import.service.ts](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/electron/services/import/bulk-import.service.ts)
Coordinating service that handles:
- Template generation and downloads.
- File loading and worksheet selection.
- Column mapping configuration profiles.
- Validations and duplicate checking.
- Transactional processing using specific entity processors.

#### [NEW] CSV & XLSX Parsers
- We will install `xlsx` library to parse both CSV and XLSX worksheets.
- Standard limit checks: 25 MB max file size, 50,000 rows limit, 100 columns limit. Password-protected files or invalid formats are rejected.

### Duplicate Validation & Policies
- **File-Level check**: Deduplicate records inside the file using unique business keys (e.g. `normalizedProductCode`, `normalizedSupplierCode`, `barcode`, etc.).
- **Database-Level check**: Run chunked indexed database SELECT queries (using `IN` clause with up to 500 keys per query) to verify if records already exist.
- **Business-Level Warning**: Detect warnings (e.g., similar names with different codes, or same phone numbers).
- **Policies**:
  - `SKIP_DUPLICATES`, `UPDATE_EXISTING`, `FAIL_ON_DUPLICATE` (allowed for master records).
  - Opening stock and supplier ledger opening entries ONLY allow `SKIP_DUPLICATES` and `FAIL_ON_DUPLICATE` to prevent mutation of accounting/inventory history.

### Transaction Modes
- `ATOMIC_ALL_OR_NOTHING`: Wrap the entire batch in a single database transaction. Rollback on any failure. (Default for inventory stock, balances, and pricing).
- `VALID_ROWS_ONLY`: Processes rows in batches of 100. Ignores invalid rows, commits valid rows. (Default for UOM, TaxRate, Product, Supplier).

### Context Bridge IPC & Preload APIs
Expose narrow endpoints:
- `selectImportFile`: Triggers Electron's safe native file picker.
- `parseImportFile`, `validateImport`, `executeImport`, `getImportHistory`, `exportImportErrorReport`.
- No raw paths, fs, or SQL connection handles are exposed to the browser.

---

## 3. Supported Import Types & Templates

### 1. Units
Columns: `Unit Code*`, `Unit Name*`, `Decimal Allowed`, `Decimal Precision`, `Active`

### 2. Tax Rates
Columns: `Tax Code*`, `Tax Name*`, `Tax Category*`, `GST Rate`, `CGST Rate`, `SGST Rate`, `IGST Rate`, `Cess Rate`, `Active`

### 3. Price Books
Columns: `Price Book Code*`, `Price Book Name*`, `Description`, `Active`

### 4. Products
Columns: `Product Code*`, `Product Name*`, `Product Type*`, `SKU`, `Description`, `HSN/SAC Code`, `Unit Code*`, `Tax Code`, `Brand`, `Category`, `Track Inventory`, `Allow Negative Stock`, `Minimum Stock`, `Maximum Stock`, `Reorder Level`, `Purchase Price`, `MRP`, `Active`

### 5. Product Barcodes
Columns: `Product Code*`, `Barcode*`, `Barcode Type`, `Is Primary`, `Active`

### 6. Product Prices
Columns: `Product Code*`, `Price Book Code*`, `Purchase Price`, `Selling Price*`, `MRP`, `Minimum Selling Price`, `Effective From`, `Effective To`, `Active`

### 7. Opening Stock
Columns: `Reference Number*`, `Opening Date*`, `Product Code*`, `Quantity*`, `Unit Cost`, `Batch Number`, `Manufacturing Date`, `Expiry Date`, `Notes`
- Posts via `InventoryService.postOpeningStock`.

### 8. Suppliers
Columns: `Supplier Code*`, `Supplier Name*`, `Contact Person`, `Phone`, `Alternate Phone`, `Email`, `GST Number`, `PAN Number`, `Address Line 1`, `Address Line 2`, `City`, `State`, `Postal Code`, `Country`, `Payment Terms Days`, `Credit Limit`, `Notes`, `Active`

### 9. Supplier Opening Balances
Columns: `Reference Number*`, `Balance Date*`, `Supplier Code*`, `Opening Balance*`, `Opening Balance Type*`, `Notes`
- Posts via `SupplierLedgerService.recordOpening` transaction.

---

## 4. UI Components

A new sidebar menu entry `Data Import` will be added to navigate to the common bulk import interface. 

Components under `src/components/import/`:
- `BulkImportModule.tsx`: Main layout coordinator.
- `ImportTypeSelector.tsx`: Dropdown grid of the 9 types.
- `ImportFilePicker.tsx`: Handles CSV/XLSX file selection and template downloads.
- `ImportColumnMapper.tsx`: Grid to map worksheet columns to entity properties (with case/space insensitive auto-match).
- `ImportValidationSummary.tsx`: Summary chart (Valid rows, invalid rows, duplicates).
- `ImportPreviewTable.tsx`: Scrollable/paginated grid of rows with status and proposed actions.
- `ImportDuplicateReview.tsx`: Grouped duplicates, policy selector (`SKIP`, `UPDATE`, `FAIL`).
- `ImportResultSummary.tsx`: Total processed, inserted, updated, skipped, and failed logs.
- `ImportHistory.tsx`: History list of all previous jobs.
- `ImportErrorReport.tsx`: Action to download the formatted error report CSV.

---

## 5. Verification Plan

### Automated Integration Tests
Create a comprehensive test suite `scripts/test-import-integration.ts` executing:
- Parsing valid/invalid/empty worksheets.
- Mapping columns case-insensitively.
- File-level and Database-level duplicate check.
- Idempotency check: verify re-import of same opening stock/supplier balance is rejected.
- Transaction validation: verify atomic rollback on invalid stock row.
- Dependency verification: reject products with missing Unit/Tax.
- Security constraints: verify no native code/fs leakage on renderer.

### Packaged Electron Smoke Test
Create `scripts/run-packaged-bulk-import-smoke.js` to run against the packaged app inside a clean `test-data/electron-bulk-import-smoke/user-data` path:
1. Compile and bundle via Vite / Esbuild.
2. Package the app via `electron-builder`.
3. Launch the packaged app, select and import a custom test CSV/XLSX sheet.
4. Verify import of UOM, Tax, Products, Barcodes, Prices, Opening Stock, Suppliers, and Supplier Balances.
5. Verify duplicate warning prompts and error reporting.
6. Verify no SQLCipher/DPAPI secret exposure.
