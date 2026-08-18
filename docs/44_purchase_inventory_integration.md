# Purchase Inventory Integration

Renderer code never writes inventory rows for purchases.

Posting flow:

`PurchaseService.postPurchase` -> `InventoryService.postPurchaseIn` -> `InventoryTransaction(PURCHASE_IN)`

Only stock-tracked `GOODS` products create inventory movements. `SERVICE` products remain in purchase lines but do not create stock movements.

Cancellation calls `InventoryService.reverseTransaction` for each linked purchase inventory transaction. Original stock movements are preserved.
