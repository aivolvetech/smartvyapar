-- =============================================================================
-- Corrective Migration: 20260805120000_customer_constraints_correction
-- Smart Vyapar - Phase 6.2 Customer Ledger CHECK constraints fix
-- Enforce that both debit and credit cannot be zero at the same time.
-- =============================================================================

PRAGMA foreign_keys = OFF;

-- 1. Rename existing table
ALTER TABLE "CustomerLedgerEntry" RENAME TO "CustomerLedgerEntry_old";

-- 2. Create the corrected table
CREATE TABLE "CustomerLedgerEntry" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "customerId"      TEXT NOT NULL,
    "shopId"          TEXT NOT NULL,
    "entryType"       TEXT NOT NULL,
    "referenceType"   TEXT NOT NULL,
    "referenceId"     TEXT NOT NULL,
    "referenceNumber" TEXT,
    "debitAmount"     REAL NOT NULL DEFAULT 0,
    "creditAmount"    REAL NOT NULL DEFAULT 0,
    "occurredAt"      TEXT NOT NULL,
    "notes"           TEXT,
    "idempotencyKey"  TEXT UNIQUE,
    "createdAt"       TEXT NOT NULL,

    CHECK ("entryType" IN ('OPENING_BALANCE', 'SALE', 'SALE_CANCELLATION', 'RECEIPT', 'RECEIPT_REVERSAL', 'SALES_RETURN', 'CREDIT_NOTE', 'DEBIT_NOTE', 'ADJUSTMENT')),
    CHECK ("debitAmount" >= 0),
    CHECK ("creditAmount" >= 0),
    CHECK (
        ("debitAmount" > 0 AND "creditAmount" = 0) OR
        ("creditAmount" > 0 AND "debitAmount" = 0)
    ),
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id"),
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id")
);

-- 3. Copy records from old table
INSERT INTO "CustomerLedgerEntry" (
    "id", "customerId", "shopId", "entryType", "referenceType", "referenceId",
    "referenceNumber", "debitAmount", "creditAmount", "occurredAt", "notes", "idempotencyKey", "createdAt"
)
SELECT 
    "id", "customerId", "shopId", "entryType", "referenceType", "referenceId",
    "referenceNumber", "debitAmount", "creditAmount", "occurredAt", "notes", "idempotencyKey", "createdAt"
FROM "CustomerLedgerEntry_old";

-- 4. Drop the old table
DROP TABLE "CustomerLedgerEntry_old";

-- 5. Re-create indexes
CREATE INDEX "CustomerLedgerEntry_customerId_idx" ON "CustomerLedgerEntry"("customerId");
CREATE INDEX "CustomerLedgerEntry_shopId_idx" ON "CustomerLedgerEntry"("shopId");
CREATE INDEX "CustomerLedgerEntry_occurredAt_idx" ON "CustomerLedgerEntry"("occurredAt");
CREATE INDEX "CustomerLedgerEntry_reference_idx" ON "CustomerLedgerEntry"("referenceType", "referenceId");

PRAGMA foreign_keys = ON;
