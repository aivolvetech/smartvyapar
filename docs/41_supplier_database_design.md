# Supplier Database Design

Phase 5 adds `Supplier` with normalized supplier code and normalized name for stable search and uniqueness. `Supplier_normalizedSupplierCode_key` enforces case-insensitive duplicate-code protection.

Supplier does not store payments. `openingBalance` is master metadata; the payable/receivable effect is represented by immutable `SupplierLedgerEntry`.

Important constraints:

- `paymentTermsDays >= 0`
- `creditLimit >= 0`
- `openingBalance >= 0`
- `openingBalanceType IN ('PAYABLE','RECEIVABLE','NONE')`

Suppliers are deactivated rather than hard-deleted from the UI.
