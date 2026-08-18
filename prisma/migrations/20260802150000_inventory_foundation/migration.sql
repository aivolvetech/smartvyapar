-- =============================================================================
-- Migration: 20260802150000_inventory_foundation
-- Smart Vyapar Phase 4 - Inventory Foundation
-- Ledger is authoritative: current stock = SUM(InventoryTransaction.quantity)
-- =============================================================================

CREATE TABLE "InventoryTransaction" (
    "id"                      TEXT NOT NULL PRIMARY KEY,
    "shopId"                  TEXT NOT NULL,
    "productId"               TEXT NOT NULL,
    "transactionType"         TEXT NOT NULL,
    "quantity"                REAL NOT NULL,
    "unitCost"                REAL NOT NULL DEFAULT 0,
    "totalCost"               REAL,
    "referenceType"           TEXT,
    "referenceId"             TEXT,
    "referenceNumber"         TEXT,
    "sourceTransactionId"     TEXT,
    "reversalOfTransactionId" TEXT,
    "reasonCode"              TEXT,
    "notes"                   TEXT,
    "occurredAt"              TEXT NOT NULL,
    "postedAt"                TEXT NOT NULL,
    "createdAt"               TEXT NOT NULL,
    "updatedAt"               TEXT NOT NULL,
    "version"                 INTEGER NOT NULL DEFAULT 1,
    CHECK ("quantity" <> 0),
    CHECK ("unitCost" >= 0),
    CHECK ("transactionType" IN (
        'OPENING',
        'ADJUSTMENT_IN',
        'ADJUSTMENT_OUT',
        'DAMAGE_OUT',
        'EXPIRY_OUT',
        'LOSS_OUT',
        'PURCHASE_IN',
        'SALE_OUT',
        'SALE_RETURN_IN',
        'PURCHASE_RETURN_OUT',
        'TRANSFER_IN',
        'TRANSFER_OUT',
        'REVERSAL'
    )),
    CHECK ("reversalOfTransactionId" IS NULL OR "reversalOfTransactionId" <> "id"),
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id"),
    FOREIGN KEY ("productId") REFERENCES "Product"("id"),
    FOREIGN KEY ("sourceTransactionId") REFERENCES "InventoryTransaction"("id"),
    FOREIGN KEY ("reversalOfTransactionId") REFERENCES "InventoryTransaction"("id")
);

CREATE INDEX "InventoryTransaction_shopId_idx" ON "InventoryTransaction"("shopId");
CREATE INDEX "InventoryTransaction_productId_idx" ON "InventoryTransaction"("productId");
CREATE INDEX "InventoryTransaction_transactionType_idx" ON "InventoryTransaction"("transactionType");
CREATE INDEX "InventoryTransaction_occurredAt_idx" ON "InventoryTransaction"("occurredAt");
CREATE INDEX "InventoryTransaction_postedAt_idx" ON "InventoryTransaction"("postedAt");
CREATE INDEX "InventoryTransaction_reference_idx" ON "InventoryTransaction"("referenceType", "referenceId");
CREATE INDEX "InventoryTransaction_reversalOf_idx" ON "InventoryTransaction"("reversalOfTransactionId");
CREATE INDEX "InventoryTransaction_product_occurredAt_idx" ON "InventoryTransaction"("productId", "occurredAt");
CREATE UNIQUE INDEX "InventoryTransaction_one_reversal_key"
    ON "InventoryTransaction"("reversalOfTransactionId")
    WHERE "reversalOfTransactionId" IS NOT NULL;

CREATE TABLE "InventoryAdjustment" (
    "id"               TEXT NOT NULL PRIMARY KEY,
    "adjustmentNumber" TEXT NOT NULL,
    "adjustmentType"   TEXT NOT NULL,
    "reasonCode"       TEXT NOT NULL,
    "notes"            TEXT,
    "occurredAt"       TEXT NOT NULL,
    "status"           TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt"        TEXT NOT NULL,
    "updatedAt"        TEXT NOT NULL,
    CHECK ("status" IN ('DRAFT', 'POSTED', 'REVERSED')),
    CHECK ("adjustmentType" IN ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE_OUT', 'EXPIRY_OUT', 'LOSS_OUT'))
);

CREATE UNIQUE INDEX "InventoryAdjustment_number_key" ON "InventoryAdjustment"("adjustmentNumber");
CREATE INDEX "InventoryAdjustment_status_idx" ON "InventoryAdjustment"("status");

CREATE TABLE "InventoryAdjustmentLine" (
    "id"                 TEXT NOT NULL PRIMARY KEY,
    "adjustmentId"       TEXT NOT NULL,
    "productId"          TEXT NOT NULL,
    "systemQuantity"     REAL NOT NULL DEFAULT 0,
    "countedQuantity"    REAL,
    "differenceQuantity" REAL NOT NULL,
    "unitCost"           REAL NOT NULL DEFAULT 0,
    "notes"              TEXT,
    "createdAt"          TEXT NOT NULL,
    FOREIGN KEY ("adjustmentId") REFERENCES "InventoryAdjustment"("id"),
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
);

CREATE INDEX "InventoryAdjustmentLine_adjustmentId_idx" ON "InventoryAdjustmentLine"("adjustmentId");
CREATE INDEX "InventoryAdjustmentLine_productId_idx" ON "InventoryAdjustmentLine"("productId");

ALTER TABLE "InventoryOpeningBalance" ADD COLUMN "migratedTransactionId" TEXT;
ALTER TABLE "InventoryOpeningBalance" ADD COLUMN "migrationStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "InventoryOpeningBalance" ADD COLUMN "migratedAt" TEXT;

CREATE INDEX "InventoryOpeningBalance_migratedTransactionId_idx"
    ON "InventoryOpeningBalance"("migratedTransactionId");
CREATE INDEX "InventoryOpeningBalance_migrationStatus_idx"
    ON "InventoryOpeningBalance"("migrationStatus");

INSERT OR IGNORE INTO "InventoryTransaction" (
    "id",
    "shopId",
    "productId",
    "transactionType",
    "quantity",
    "unitCost",
    "totalCost",
    "referenceType",
    "referenceId",
    "referenceNumber",
    "reasonCode",
    "notes",
    "occurredAt",
    "postedAt",
    "createdAt",
    "updatedAt",
    "version"
)
SELECT
    'opening-' || iob."id",
    iob."shopId",
    iob."productId",
    'OPENING',
    iob."quantity",
    iob."unitCost",
    iob."quantity" * iob."unitCost",
    'OPENING_BALANCE',
    iob."id",
    iob."reference",
    'OPENING_BALANCE_MIGRATION',
    'Migrated from InventoryOpeningBalance',
    iob."recordedAt",
    datetime('now'),
    datetime('now'),
    datetime('now'),
    1
FROM "InventoryOpeningBalance" iob
INNER JOIN "Product" p ON p."id" = iob."productId"
WHERE iob."quantity" > 0
  AND p."productType" = 'GOODS'
  AND p."trackInventory" = 1
  AND NOT EXISTS (
      SELECT 1 FROM "InventoryTransaction" it
      WHERE it."referenceType" = 'OPENING_BALANCE'
        AND it."referenceId" = iob."id"
        AND it."transactionType" = 'OPENING'
  );

UPDATE "InventoryOpeningBalance"
SET
    "migratedTransactionId" = 'opening-' || "id",
    "migrationStatus" = 'MIGRATED',
    "migratedAt" = datetime('now')
WHERE "quantity" > 0
  AND EXISTS (
      SELECT 1 FROM "InventoryTransaction" it
      WHERE it."id" = 'opening-' || "InventoryOpeningBalance"."id"
  );

UPDATE "InventoryOpeningBalance"
SET
    "migrationStatus" = 'SKIPPED_ZERO',
    "migratedAt" = datetime('now')
WHERE "quantity" = 0
  AND "migrationStatus" = 'PENDING';

UPDATE "InventoryOpeningBalance"
SET
    "migrationStatus" = 'SKIPPED_NON_INVENTORY_PRODUCT',
    "migratedAt" = datetime('now')
WHERE "migrationStatus" = 'PENDING'
  AND EXISTS (
      SELECT 1 FROM "Product" p
      WHERE p."id" = "InventoryOpeningBalance"."productId"
        AND (p."productType" <> 'GOODS' OR p."trackInventory" <> 1)
  );
