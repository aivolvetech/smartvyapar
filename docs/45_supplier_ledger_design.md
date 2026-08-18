# Supplier Ledger Design

`SupplierLedgerEntry` is immutable. Outstanding is derived as:

`creditAmount - debitAmount`

Phase 5 entries:

- `OPENING_BALANCE`
- `PURCHASE`
- `PURCHASE_CANCELLATION`

Posting a purchase creates a credit entry. Cancelling a purchase creates a debit entry. Supplier payments and purchase returns are reserved for later phases.
