# Bulk Import Completion Audit & Domain-Rule Parity Audit

## 1. Domain-Rule Parity Audit

We audited the validation, normalization, and business rule logic across all 6 target entities to identify discrepancies between the normal async application services and the synchronous bulk-import processors.

| Entity | Async Service Rule | Processor Bypass Check | Extraction / Refactoring Resolution |
|---|---|---|---|
| **Product** | Fields required, type bounds (30 char code, 200 char name), Goods/Service type rules. | Direct repository insertions bypassed name length bounds. | Extracted into `validateProductFields()` and `enforceServiceProductRestrictions()` inside `domain-rules.ts`. Callers on both sides now share this logic. |
| **Supplier** | Email regex, GST validation (15 chars), PAN format, phone bounds, non-negative terms. | Processor relied on raw column checks. | Extracted into `validateSupplierFields()` inside `domain-rules.ts`. `SupplierService.validate()` and `SupplierImportProcessor` now invoke this identical function. |
| **ProductPrice** | MRP >= Selling Price >= Purchase Price >= 0. Overlap prevention. | Processors used database prepare statements directly. | Extracted validation constraints into `validateProductPrice()` inside `domain-rules.ts`. Date ranges overlap validation is shared via `ImportValidationService` checks. |
| **Barcode** | Unique check, empty check, max 1 primary. | Processor did basic primary count checks manually. | Extracted validation into `validateBarcodeBatch()` inside `domain-rules.ts`. Both `ProductService` and import paths now call it. |
| **Opening Stock** | Track inventory enabled, GOODS only, quantity > 0. | Processor bypassed core service checks. | Extracted into `enforceInventoryEligibility()` and `validateOpeningStock()` inside `domain-rules.ts`. Integrated check directly in `OpeningStockImportProcessor`. |
| **Supplier Opening Balance** | Post once, sign convention (PAYABLE=credit, RECEIVABLE=debit). | Processor posted raw entries with positive/negative checks in mapper. | Extracted into `validateSupplierOpeningBalance()` inside `domain-rules.ts` to enforce valid ledger entries and sign conventions. Idempotency is enforced via duplicate detection compound keys. |

---

## 2. Rule Extraction Details

### Shared Validator Module: `electron/services/import/domain-rules.ts`
All business validation and normalization rules are extracted into pure functions. These functions contain zero async operations and do not communicate with the database, allowing them to run synchronously inside database write transactions.

### Refactored Call Sites:
1. **ProductService** & **ProductImportProcessor** → call `validateProductFields()`, `enforceServiceProductRestrictions()`, `validateProductPrice()`, `validateBarcodeBatch()`.
2. **SupplierService** & **SupplierImportProcessor** → call `validateSupplierFields()`.
3. **SupplierOpeningBalanceImportProcessor** → calls `validateSupplierOpeningBalance()`.
4. **OpeningStockImportProcessor** → calls `enforceInventoryEligibility()`, `validateOpeningStock()`.

---

## 3. Immutability & Persistence-Only Repositories

All repositories (`ProductRepository`, `SupplierRepository`, `SupplierLedgerRepository`, etc.) are now strictly **persistence-only**. They do not perform high-level business validation, sign conversion, or code formatting. All constraints are checked at the service/processor level before data reaches the repository.

---

## 4. Transaction Participation & Atomicity

### SQLite Nested Transactions
- The bulk-import engine wraps the entire import batch in a single database transaction:
  ```typescript
  db.transaction(() => {
    for (const row of rows) {
      processor.process(row, ...);
    }
  })();
  ```
- `InventoryService.postOpeningStock` is invoked by `OpeningStockImportProcessor`.
- `InventoryService.postOpeningStock` delegates to `postInbound`, which calls `db.transaction(() => ...)` internally.
- In `better-sqlite3`, if a transaction is already active on the connection, calling `db.transaction()` automatically starts a nested `SAVEPOINT` instead of a new `BEGIN TRANSACTION`.
- Therefore, the nested transaction participates fully in the outer import transaction. If any subsequent row fails in `ATOMIC_ALL_OR_NOTHING` mode, the outer transaction rolls back, which automatically reverts the nested savepoint, leaving zero partial stock or ledger entries.
