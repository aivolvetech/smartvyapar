# Purchase Database Design

Phase 5 adds:

- `PurchaseInvoice`
- `PurchaseInvoiceLine`
- `DocumentSequence`

Purchase status is constrained to `DRAFT`, `POSTED`, and `CANCELLED`. Draft purchases are editable and deletable. Posted and cancelled purchases remain auditable.

`PurchaseInvoiceLine` stores product, unit, tax, HSN/SAC, and price snapshots so posted purchases do not change when masters change later.

`purchaseNumber` is unique. Supplier invoice duplicate detection is enforced through a filtered unique index on `supplierId + supplierInvoiceNumber`.
