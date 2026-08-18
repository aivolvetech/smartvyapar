# Phase 6: Sales Inventory Integration

This document defines how Sales Invoice transactions post deductions to and reverse transactions from the authoritative Inventory Ledger in Smart Vyapar.

---

## 1. Controlled Boundary Interface

All stock changes must be requested through `InventoryService`. Direct inserts to `InventoryTransaction` from renderer or billing controllers are prohibited.

The `InventoryService` will be extended with the following method:

```typescript
public postSaleOut(input: {
  productId: string;
  quantity: number; // Positive number (service will negate it for sale-out)
  unitCost: number; // Avg cost resolved via existing inventory bounds
  referenceType: 'SALES_INVOICE';
  referenceId: string;
  referenceNumber: string;
  occurredAt: string;
}): InventoryTransaction;
```

---

## 2. Integration Rules

- **Product Types**:
  - **GOODS**:
    - If `trackInventory = 1`, the invoice line MUST post a `SALE_OUT` inventory transaction.
    - If `trackInventory = 0`, inventory posting is skipped.
  - **SERVICE**:
    - Inventory posting is completely skipped.
- **Transaction Negation**:
  - `postSaleOut` will store the quantity in `InventoryTransaction` as a negative number (e.g. sale of 5 items is stored as `-5.0`).
- **Negative-Stock Policy Check**:
  - If `allowNegativeStock = 0` (block negative stock):
    - The transaction must query `currentStock` from `InventoryTransactionRepository`.
    - If `currentStock - requestedQty < 0`, posting must be rejected with an `Insufficient stock` error, rolling back the outer SQLite transaction.
  - If `allowNegativeStock = 1` (allow negative stock):
    - The transaction will post successfully and let stock drop below zero.
- **Valuation / Cost Resolution**:
  - Do **not** create or implement new average-cost calculation logic for Phase 6. We will use the existing `averageCost` method on `InventoryTransactionRepository` through the established `InventoryService` boundary only.
- **Reference Linkage**:
  - The generated `InventoryTransaction.id` is written back to the corresponding `SalesInvoiceLine.inventoryTransactionId` row.

---

## 3. Reversal and Cancellation Flow

When a posted invoice is cancelled:
- Iterate through each line of the invoice.
- If `inventoryTransactionId` is set, execute:

```typescript
this.inventoryService.reverseTransaction({
  transactionId: line.inventoryTransactionId,
  reason: 'SALES_CANCELLED',
  notes: `Sale cancelled: ${cancellationReason}`,
});
```

- This inserts a `REVERSAL` transaction in `InventoryTransaction` with a positive quantity, reversing the negative stock impact.
- Set `SalesInvoiceLine.inventoryTransactionId = NULL` or keep it linked but mark the reversal record to maintain auditability.
- If negative stock is not allowed, the reversal (which adds stock back) is always safe and cannot trigger negative-stock blockages.
- Once cancelled, the invoice status changes to `CANCELLED` and is locked.
- Prevent double cancellation: verify the status is exactly `POSTED` before reversing.
- Post-cancellation repost is blocked.
- All modifications must run inside a single synchronous SQLite transaction context.
- If any step fails, the entire transaction is rolled back.
- Renderer cannot directly invoke inventory APIs.
