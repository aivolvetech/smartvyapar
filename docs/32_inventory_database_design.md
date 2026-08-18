# 32. Inventory Database Design

Date: 2026-08-02

Phase 4 adds immutable inventory ledger tables in:

`prisma/migrations/20260802150000_inventory_foundation/migration.sql`

## Tables

- `InventoryTransaction`: authoritative stock ledger.
- `InventoryAdjustment`: posted adjustment/damage/expiry/loss header.
- `InventoryAdjustmentLine`: product line for adjustment header.

No `InventoryBalance` projection table was introduced. Current stock is calculated from:

```text
SUM(InventoryTransaction.quantity)
```

## Legacy Opening Balance

`InventoryOpeningBalance` is preserved and extended with:

- `migratedTransactionId`
- `migrationStatus`
- `migratedAt`

Positive valid opening balances are migrated to `InventoryTransaction` rows with `transactionType = OPENING`. Zero rows are marked `SKIPPED_ZERO`; non-inventory product rows are marked `SKIPPED_NON_INVENTORY_PRODUCT`.

## Indexes

Key indexes include:

- `InventoryTransaction_shopId_idx`
- `InventoryTransaction_productId_idx`
- `InventoryTransaction_shopId_productId_idx`
- `InventoryTransaction_transactionType_idx`
- `InventoryTransaction_occurredAt_idx`
- `InventoryTransaction_postedAt_idx`
- `InventoryTransaction_reference_idx`
- `InventoryTransaction_reversalOf_idx`
- `InventoryTransaction_product_occurredAt_idx`
- `InventoryTransaction_one_reversal_key`
- `InventoryAdjustment_number_key`
- `InventoryAdjustment_status_idx`

## Constraints

- Quantity cannot be zero.
- Unit cost cannot be negative.
- Transaction types are enum-constrained.
- Self-reversal is blocked.
- A transaction can have only one reversal through a unique partial index.
- Product and Shop foreign keys remain enforced.

