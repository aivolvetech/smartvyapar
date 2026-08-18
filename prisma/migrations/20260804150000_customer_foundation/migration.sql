-- =============================================================================
-- Migration: 20260804150000_customer_foundation
-- Smart Vyapar Phase 6.2 - Customer and Receivable/Activity Ledger
-- =============================================================================

-- 1. Customer Table -----------------------------------------------------------
CREATE TABLE "Customer" (
    "id"                     TEXT NOT NULL PRIMARY KEY,
    "shopId"                 TEXT NOT NULL,
    "customerCode"           TEXT NOT NULL,
    "normalizedCustomerCode" TEXT NOT NULL,
    "name"                   TEXT NOT NULL,
    "normalizedName"         TEXT NOT NULL,
    "customerType"           TEXT NOT NULL DEFAULT 'RETAIL',
    "contactPerson"          TEXT,
    "phone"                  TEXT,
    "normalizedPhone"         TEXT,
    "alternatePhone"         TEXT,
    "email"                  TEXT,
    "gstNumber"              TEXT,
    "panNumber"              TEXT,
    "billingAddressLine1"    TEXT,
    "billingAddressLine2"    TEXT,
    "shippingAddressLine1"   TEXT,
    "shippingAddressLine2"   TEXT,
    "city"                   TEXT,
    "state"                  TEXT,
    "postalCode"             TEXT,
    "country"                TEXT NOT NULL DEFAULT 'India',
    "paymentTermsDays"       INTEGER NOT NULL DEFAULT 0,
    "creditLimit"            REAL NOT NULL DEFAULT 0,
    "priceBookId"            TEXT,
    "notes"                  TEXT,
    "isWalkIn"               INTEGER NOT NULL DEFAULT 0,
    "isActive"               INTEGER NOT NULL DEFAULT 1,
    "createdAt"              TEXT NOT NULL,
    "updatedAt"              TEXT NOT NULL,
    "version"                INTEGER NOT NULL DEFAULT 1,

    CHECK ("customerType" IN ('WALK_IN', 'RETAIL', 'WHOLESALE', 'DISTRIBUTOR', 'CORPORATE')),
    CHECK ("paymentTermsDays" >= 0),
    CHECK ("creditLimit" >= 0),
    CHECK ("isWalkIn" IN (0, 1)),
    CHECK ("isActive" IN (0, 1)),
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id"),
    FOREIGN KEY ("priceBookId") REFERENCES "PriceBook"("id")
);

-- Indices for Customer Table
CREATE UNIQUE INDEX "Customer_shopId_normalizedCustomerCode_key" ON "Customer"("shopId", "normalizedCustomerCode");
CREATE UNIQUE INDEX "Customer_shopId_isWalkIn_key" ON "Customer"("shopId", "isWalkIn") WHERE "isWalkIn" = 1;
CREATE INDEX "Customer_normalizedName_idx" ON "Customer"("normalizedName");
CREATE INDEX "Customer_normalizedPhone_idx" ON "Customer"("normalizedPhone");
CREATE INDEX "Customer_gstNumber_idx" ON "Customer"("gstNumber");
CREATE INDEX "Customer_isActive_idx" ON "Customer"("isActive");
CREATE INDEX "Customer_customerType_idx" ON "Customer"("customerType");
CREATE INDEX "Customer_priceBookId_idx" ON "Customer"("priceBookId");
CREATE INDEX "Customer_shopId_idx" ON "Customer"("shopId");

-- Seed Walk-In Customer for any existing shops
INSERT OR IGNORE INTO "Customer" (
    "id", "shopId", "customerCode", "normalizedCustomerCode", "name", "normalizedName",
    "customerType", "isWalkIn", "isActive", "paymentTermsDays", "creditLimit", "createdAt", "updatedAt", "version"
)
SELECT
    'walkin-' || "id",
    "id",
    'WALK-IN',
    'walk-in',
    'Walk-In Customer',
    'walk-in customer',
    'WALK_IN',
    1,
    1,
    0,
    0,
    datetime('now'),
    datetime('now'),
    1
FROM "Shop";

-- 2. Customer Ledger Entry Table -----------------------------------------------
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
        ("creditAmount" > 0 AND "debitAmount" = 0) OR
        ("debitAmount" = 0 AND "creditAmount" = 0)
    ),
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id"),
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id")
);

-- Indices for Customer Ledger Table
CREATE INDEX "CustomerLedgerEntry_customerId_idx" ON "CustomerLedgerEntry"("customerId");
CREATE INDEX "CustomerLedgerEntry_shopId_idx" ON "CustomerLedgerEntry"("shopId");
CREATE INDEX "CustomerLedgerEntry_occurredAt_idx" ON "CustomerLedgerEntry"("occurredAt");
CREATE INDEX "CustomerLedgerEntry_reference_idx" ON "CustomerLedgerEntry"("referenceType", "referenceId");
