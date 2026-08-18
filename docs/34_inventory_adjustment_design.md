# 34. Inventory Adjustment Design

Date: 2026-08-02

Phase 4 implements posted single-product adjustment flows with an expandable header/line model.

## Header

`InventoryAdjustment` stores:

- adjustment number
- adjustment type
- reason
- notes
- occurred date
- status

Initial statuses are `DRAFT`, `POSTED`, and `REVERSED`. Phase 4 creates posted adjustments directly from the UI.

## Lines

`InventoryAdjustmentLine` stores:

- product
- system quantity
- counted quantity where applicable
- difference quantity
- unit cost
- notes

## Supported Flows

- Adjustment In
- Adjustment Out
- Damage Out
- Expiry Out
- Loss Out

All flows post an immutable `InventoryTransaction` row. Damage, expiry, and loss are not supplier return, insurance, or accounting workflows.

