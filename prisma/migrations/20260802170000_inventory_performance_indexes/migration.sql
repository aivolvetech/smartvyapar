-- =============================================================================
-- Migration: 20260802170000_inventory_performance_indexes
-- Smart Vyapar Phase 4 - Inventory read performance indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS "InventoryTransaction_shopId_productId_idx"
    ON "InventoryTransaction"("shopId", "productId");

