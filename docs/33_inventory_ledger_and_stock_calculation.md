# 33. Inventory Ledger and Stock Calculation

Date: 2026-08-02

Inventory stock is ledger-derived:

```text
Current Stock = SUM(InventoryTransaction.quantity)
```

Positive quantities increase stock; negative quantities reduce stock. `Product` does not store current stock.

## Implemented Posting Types

- `OPENING`
- `ADJUSTMENT_IN`
- `ADJUSTMENT_OUT`
- `DAMAGE_OUT`
- `EXPIRY_OUT`
- `LOSS_OUT`
- `REVERSAL`

Future enum values are reserved for Purchase, Billing, Returns, and Transfers, but those workflows are not implemented in Phase 4.

## Validation

`InventoryService` enforces:

- Product must exist.
- Product must be `GOODS`.
- `trackInventory` must be enabled.
- Quantity must be greater than zero at API boundary.
- Unit cost cannot be negative.
- Renderer-provided signs are not trusted.
- Negative stock follows `Product.allowNegativeStock`.

## Reversal

Posted transactions are immutable. Corrections use `reverseTransaction`, which posts a `REVERSAL` row with opposite quantity and references the original transaction. Double reversal is rejected.

## Costing

Opening and adjustment-in store supplied unit cost. Outbound movements use the current average inbound cost when available. Full inventory valuation and accounting entries are reserved for later Purchase/Accounting phases.

