# 35. Inventory UI Walkthrough

Date: 2026-08-02

The Inventory coming-soon placeholder is replaced with a functional module at:

`src/components/inventory/`

## Views

- `InventoryOverview`: real inventory summary cards and quick actions.
- `InventoryStockList`: paginated stock list with search and status filter.
- `ProductStockView`: product identity, stock quantity, thresholds, negative-stock policy, average cost, and recent movements.
- `InventoryMovementHistory`: paginated movement ledger.
- `InventoryAdjustmentForm`: adjustment in/out posting.
- `DamageStockForm`: damage posting.
- `ExpiredStockForm`: expiry posting.
- `LostStockForm`: loss posting.
- `InventoryStatusBadge`: stock status display.

## Product Integration

Product View now calls inventory APIs for quantity-on-hand and stock status. Product does not become the stock source of truth.

## Dashboard Integration

Dashboard Low Stock now reads from `getInventoryDashboardSummary()`. Sales, bills, customers, purchases, expenses, and reports remain future phases.

## Evidence

Screenshots are saved under:

`docs/evidence/inventory-foundation/`

