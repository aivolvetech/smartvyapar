# 31. Inventory Foundation Implementation Plan

Date: 2026-08-02

## Repository Audit

Phase 3 has Product Master, SQLCipher, DPAPI, custom migrations, secure IPC/preload, packaged smoke, and zero Prisma runtime/query engines. The application remains a single-store offline desktop app; the existing single `Shop` row is the store context.

Existing inventory-related fields:

- `Product.productType`: `GOODS` or `SERVICE`.
- `Product.trackInventory`: disables inventory for services and optional non-tracked goods.
- `Product.allowNegativeStock`: product-level stock-out policy.
- `Product.minimumStockLevel`, `reorderLevel`, `maximumStockLevel`: alert thresholds. Null means not configured.
- `InventoryOpeningBalance`: legacy/setup-history table with `productId`, `shopId`, `quantity`, `unitCost`, `recordedAt`, `reference`, `createdAt`.
- `ProductService.createProduct()` creates Product, Barcode, ProductPrice, and optional InventoryOpeningBalance inside one database transaction.
- Renderer Product UI captures opening quantity/cost but does not calculate current stock.

## Existing Opening-Balance Behavior

Opening balance is currently persisted as a setup record only. It is not part of an immutable stock ledger, and current stock is not derived from movements.

Phase 4 preserves every existing `InventoryOpeningBalance` row and posts a matching `InventoryTransaction` with `transactionType = OPENING`. The legacy table remains as setup history.

## Proposed Ledger Model

Authoritative stock source:

```text
Current Stock = SUM(InventoryTransaction.quantity)
```

Positive quantity increases stock. Negative quantity reduces stock. The `Product` table will not store running stock.

## Transaction Types

Active Phase 4:

- `OPENING`
- `ADJUSTMENT_IN`
- `ADJUSTMENT_OUT`
- `DAMAGE_OUT`
- `EXPIRY_OUT`
- `LOSS_OUT`

Reserved for future phases:

- `PURCHASE_IN`
- `SALE_OUT`
- `SALE_RETURN_IN`
- `PURCHASE_RETURN_OUT`
- `TRANSFER_IN`
- `TRANSFER_OUT`

The UI must not expose Purchase, Sales, or Transfer workflows in Phase 4.

## Reversal Strategy

Inventory movements are immutable. Posted rows are not silently edited or deleted. Corrections are posted by creating a reversal transaction with the opposite quantity, `sourceTransactionId`, and `reversalOfTransactionId`. A transaction may be reversed once. Self-reversal is rejected.

## Negative-Stock Behavior

The inventory service enforces `Product.allowNegativeStock` inside the same database transaction that posts outbound movements. If negative stock is not allowed, stock-out operations fail with a friendly error like:

```text
Insufficient stock. Available: 5, requested: 8.
```

Services and non-tracked products cannot receive inventory movements.

## Alert Rules

- Out of stock: `quantityOnHand <= 0`
- Low stock: `quantityOnHand > 0 AND quantityOnHand <= minimumStockLevel`
- Reorder required: `quantityOnHand <= reorderLevel`
- Negative stock: `quantityOnHand < 0`
- Over stock: `maximumStockLevel IS NOT NULL AND quantityOnHand > maximumStockLevel`

Null thresholds are treated as not configured, never zero.

## Future Purchase/Billing Boundaries

Purchase and Billing modules will later call narrow inventory service methods from the main process. They must not write ledger rows directly from renderer code. Future transaction types are reserved in the enum only; Phase 4 does not build PO, invoice, POS, return, payment, accounting, or transfer workflows.

## Migration Strategy

Create a new chronological migration:

`prisma/migrations/20260802150000_inventory_foundation/migration.sql`

It will:

- Create `InventoryTransaction`.
- Create `InventoryAdjustment`.
- Create `InventoryAdjustmentLine`.
- Add migration marker columns to `InventoryOpeningBalance`.
- Preserve Product, Shop, ProductPrice, ProductBarcode, and legacy opening balances.
- Idempotently post one `OPENING` ledger row per valid positive opening balance.
- Mark migrated rows with `migratedTransactionId` and `migrationStatus = MIGRATED`.
- Leave zero-quantity rows as setup history with `migrationStatus = SKIPPED_ZERO`.

## InventoryBalance Decision

No `InventoryBalance` table will be introduced in the initial implementation. Current stock and alerts will be calculated from ledger aggregation queries. This keeps the ledger authoritative and avoids projection reconciliation risk. A future balance projection can be added only with rebuild/reconciliation tests.

## Rollback Strategy

The existing SQLCipher backup system remains the rollback mechanism. Before applying this phase to production data, take an encrypted backup. The legacy opening balance table remains intact, so rollback or manual reconciliation can verify original quantities and costs.

## Test Matrix

- Migration: table creation, FK checks, legacy opening balance preservation, idempotent opening ledger posting.
- Stock calculation: opening, adjustment in/out, damage, expiry, loss, reversal, multi-transaction sum.
- Validation: service products rejected, non-tracked goods rejected, zero quantity rejected, negative unit cost rejected.
- Negative stock: blocked/allowed based on product flag.
- Alerts: in stock, low, out, reorder, negative, over, null thresholds.
- Search/pagination: code/name/barcode/category/status, sort allowlist, stable order.
- Security: no raw SQL/paths/key/native modules exposed to renderer.
- Performance: stock lookup, stock list, movement history, dashboard summary.
- Packaged smoke: isolated user-data, real exe, restart persistence, no Prisma query engine.

