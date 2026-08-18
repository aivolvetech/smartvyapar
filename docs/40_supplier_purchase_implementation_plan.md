# Phase 5 Supplier and Purchase Implementation Plan

## Current Architecture

Smart Vyapar is an offline, single-store Electron desktop app. The single `Shop` row represents the current store. The main process owns SQLCipher access through `better-sqlite3-multiple-ciphers`; the renderer uses narrow `contextBridge` APIs only.

Existing foundations:

- Product Master, ProductBarcode, ProductPrice, UnitOfMeasure, TaxRate, and PriceBook are already present.
- Product quantity is not stored on Product. Current stock is derived from `InventoryTransaction`.
- `InventoryTransactionType` already reserves `PURCHASE_IN`.
- Inventory rows already support `referenceType`, `referenceId`, and `referenceNumber`.
- The migration runner applies chronological SQL migrations and records checksums in `AppMigration`.
- Product and Inventory IPC handlers validate input and block raw database access from the renderer.

## Supplier Design

Phase 5 adds `Supplier` as a master table with normalized code/name fields. Supplier code is case-insensitive unique. Supplier opening balance is captured as metadata and mirrored into `SupplierLedgerEntry` during creation.

Supplier rules:

- Supplier code and name are required.
- Payment terms, credit limit, and opening balance cannot be negative.
- Email/GST/PAN are optional but validated when present.
- Inactive suppliers cannot be used for new purchase drafts.
- Suppliers referenced by purchases are protected from hard deletion. Phase 5 exposes activation/deactivation, not delete.

## Purchase Design

Phase 5 adds `PurchaseInvoice` and `PurchaseInvoiceLine`. Drafts are editable. Posted and cancelled purchases are immutable. Supplier invoice number is optional, but duplicate supplier plus supplier invoice number is detected.

Purchase statuses:

- `DRAFT`
- `POSTED`
- `CANCELLED`

Future statuses such as `PARTIALLY_PAID`, `PAID`, and `RETURNED` are reserved for later phases only.

## Inventory Integration

Renderer code must never post inventory for purchases. The flow is:

`PurchaseService.postPurchase` -> `InventoryService.postPurchaseIn` -> `InventoryTransaction(PURCHASE_IN)`

Only stock-tracked `GOODS` lines create inventory transactions. `SERVICE` lines remain on the purchase invoice but do not affect stock.

Cancellation uses `InventoryService.reverseTransaction` against linked `PURCHASE_IN` rows. No inventory transaction is deleted.

## Tax Calculation

Tax calculation is authoritative in `PurchaseCalculationService`. It uses `TaxRate` snapshots on purchase lines. Intra-state uses CGST and SGST, while inter-state uses IGST. When supplier state or shop state is absent, Phase 5 defaults to intra-state to avoid accidental IGST.

Taxable amount is calculated after line discount. Invoice-level discount is applied deterministically by proportional allocation across lines.

## Pricing Behavior

Posting a purchase may update Product cached purchase price through the approved Product repository cache boundary. Selling price and MRP are not changed automatically.

## Posting Lifecycle

Posting is transactional:

1. Load draft.
2. Validate supplier, product, dates, and lines.
3. Recalculate totals in the service layer.
4. Create `PURCHASE_IN` inventory rows for stock-tracked goods.
5. Link inventory transaction IDs back to purchase lines.
6. Mark purchase `POSTED`.
7. Create immutable supplier ledger credit entry.
8. Commit.

If any step fails, the database transaction rolls back.

## Cancellation Behavior

Cancellation applies only to posted purchases. It requires a reason, creates inventory reversals, creates a supplier ledger debit entry, marks the purchase cancelled, and preserves the original invoice and lines.

Double posting and double cancellation are blocked.

## Supplier Payable Foundation

`SupplierLedgerEntry` is immutable. Phase 5 supports:

- `OPENING_BALANCE`
- `PURCHASE`
- `PURCHASE_CANCELLATION`

Outstanding is derived as:

`creditAmount - debitAmount`

Supplier payments and purchase returns are explicitly deferred.

## Number Generation

`DocumentSequence` stores document type, financial year, prefix, next number, and padding length. Purchase numbers use:

`PUR-YYYY-000001`

Drafts receive a purchase number at draft creation so saved drafts are identifiable. Number generation runs inside the same database transaction as draft creation.

## Migration Strategy

Create a new chronological migration after Phase 4. Do not modify earlier migrations. The migration creates Supplier, PurchaseInvoice, PurchaseInvoiceLine, SupplierLedgerEntry, DocumentSequence, and indexes.

## Rollback Strategy

Because this is an offline SQLite/SQLCipher app, rollback for a failed release is:

- Restore the encrypted database from backup.
- Reinstall the previous app package.
- Do not manually delete posted purchase rows or inventory rows.

## Test Matrix

Minimum automated coverage:

- Supplier create/update/search/active state/duplicate code/opening balance.
- Purchase draft create/update/delete/reload.
- Purchase calculation: quantity, line discount, invoice discount, GST split, totals.
- Posting: stock increase, supplier payable increase, service product skip, double post block.
- Cancellation: inventory reversal, payable reversal, double cancel block.
- Existing product and inventory tests continue to pass.

## Future Integration

Purchase Return, supplier payment settlement, AP aging, GST reporting, and accounting ledger are deferred. Phase 6 remains Customer and Billing/POS Foundation and must use `SALE_OUT` through a controlled inventory boundary.
