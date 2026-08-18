-- =============================================================================
-- Migration: 20260805150000_sales_foundation
-- Smart Vyapar - Phase 6.3 Sales Database & Draft/Hold Backend Foundation
-- =============================================================================

-- 1. Create SalesInvoice table
CREATE TABLE "SalesInvoice" (
    "id"                    TEXT NOT NULL PRIMARY KEY,
    "shopId"                TEXT NOT NULL,
    "customerId"            TEXT NOT NULL,
    "draftReference"        TEXT NOT NULL,
    "invoiceNumber"         TEXT,
    "invoiceDate"           TEXT NOT NULL,
    "dueDate"               TEXT,
    "status"                TEXT NOT NULL DEFAULT 'DRAFT',
    "paymentStatus"         TEXT NOT NULL DEFAULT 'UNPAID',
    "salesChannel"          TEXT NOT NULL DEFAULT 'POS',
    "subtotal"              REAL NOT NULL DEFAULT 0,
    "lineDiscountTotal"     REAL NOT NULL DEFAULT 0,
    "invoiceDiscountType"   TEXT NOT NULL DEFAULT 'NONE',
    "invoiceDiscountValue"  REAL NOT NULL DEFAULT 0,
    "invoiceDiscountTotal"  REAL NOT NULL DEFAULT 0,
    "taxableAmount"         REAL NOT NULL DEFAULT 0,
    "cgstTotal"             REAL NOT NULL DEFAULT 0,
    "sgstTotal"             REAL NOT NULL DEFAULT 0,
    "igstTotal"             REAL NOT NULL DEFAULT 0,
    "cessTotal"             REAL NOT NULL DEFAULT 0,
    "roundOff"              REAL NOT NULL DEFAULT 0,
    "grandTotal"            REAL NOT NULL DEFAULT 0,
    "paidAmount"            REAL NOT NULL DEFAULT 0,
    "outstandingAmount"     REAL NOT NULL DEFAULT 0,
    "changeAmount"          REAL NOT NULL DEFAULT 0,
    "notes"                 TEXT,
    "heldAt"                TEXT,
    "postedAt"              TEXT,
    "cancelledAt"           TEXT,
    "cancellationReason"    TEXT,
    "createdAt"             TEXT NOT NULL,
    "updatedAt"             TEXT NOT NULL,
    "version"               INTEGER NOT NULL DEFAULT 1,

    CHECK ("status" IN ('DRAFT', 'HELD', 'POSTED', 'CANCELLED')),
    CHECK ("paymentStatus" IN ('UNPAID', 'PARTIALLY_PAID', 'PAID')),
    CHECK ("salesChannel" IN ('POS', 'COUNTER', 'MANUAL')),
    CHECK ("invoiceDiscountType" IN ('NONE', 'PERCENT', 'AMOUNT')),
    CHECK ("subtotal" >= 0),
    CHECK ("lineDiscountTotal" >= 0),
    CHECK ("invoiceDiscountTotal" >= 0),
    CHECK ("taxableAmount" >= 0),
    CHECK ("grandTotal" >= 0),
    CHECK ("paidAmount" >= 0),
    CHECK ("outstandingAmount" >= 0),
    CHECK ("changeAmount" >= 0),
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id"),
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
);

-- Unique constraints & indexes for SalesInvoice
CREATE UNIQUE INDEX "SalesInvoice_shopId_draftReference_key" ON "SalesInvoice"("shopId", "draftReference");
CREATE UNIQUE INDEX "SalesInvoice_invoiceNumber_key" ON "SalesInvoice"("invoiceNumber") WHERE "invoiceNumber" IS NOT NULL;
CREATE INDEX "SalesInvoice_customerId_idx" ON "SalesInvoice"("customerId");
CREATE INDEX "SalesInvoice_status_idx" ON "SalesInvoice"("status");
CREATE INDEX "SalesInvoice_invoiceDate_idx" ON "SalesInvoice"("invoiceDate");
CREATE INDEX "SalesInvoice_shopId_idx" ON "SalesInvoice"("shopId");

-- 2. Create SalesInvoiceLine table
CREATE TABLE "SalesInvoiceLine" (
    "id"                        TEXT NOT NULL PRIMARY KEY,
    "salesInvoiceId"            TEXT NOT NULL,
    "productId"                 TEXT NOT NULL,
    "productCodeSnapshot"       TEXT NOT NULL,
    "productNameSnapshot"       TEXT NOT NULL,
    "barcodeSnapshot"           TEXT,
    "hsnSacCodeSnapshot"        TEXT,
    "productTypeSnapshot"       TEXT NOT NULL,
    "unitId"                    TEXT,
    "unitNameSnapshot"          TEXT,
    "taxRateId"                 TEXT,
    "taxCategorySnapshot"       TEXT NOT NULL,
    "taxRateSnapshot"           REAL NOT NULL DEFAULT 0,
    "quantity"                  REAL NOT NULL,
    "unitPrice"                 REAL NOT NULL DEFAULT 0,
    "mrp"                       REAL NOT NULL DEFAULT 0,
    "minimumSellingPrice"       REAL DEFAULT 0,
    "discountType"              TEXT NOT NULL DEFAULT 'NONE',
    "discountValue"             REAL NOT NULL DEFAULT 0,
    "discountAmount"            REAL NOT NULL DEFAULT 0,
    "invoiceDiscountAllocation" REAL NOT NULL DEFAULT 0,
    "taxableAmount"             REAL NOT NULL DEFAULT 0,
    "cgstRate"                  REAL NOT NULL DEFAULT 0,
    "cgstAmount"                REAL NOT NULL DEFAULT 0,
    "sgstRate"                  REAL NOT NULL DEFAULT 0,
    "sgstAmount"                REAL NOT NULL DEFAULT 0,
    "igstRate"                  REAL NOT NULL DEFAULT 0,
    "igstAmount"                REAL NOT NULL DEFAULT 0,
    "cessRate"                  REAL NOT NULL DEFAULT 0,
    "cessAmount"                REAL NOT NULL DEFAULT 0,
    "lineTotal"                 REAL NOT NULL DEFAULT 0,
    "inventoryTransactionId"    TEXT,
    "createdAt"                 TEXT NOT NULL,
    "updatedAt"                 TEXT NOT NULL,

    CHECK ("productTypeSnapshot" IN ('GOODS', 'SERVICE')),
    CHECK ("taxCategorySnapshot" IN ('EXEMPT', 'GST', 'ZERO_RATED', 'NON_GST')),
    CHECK ("discountType" IN ('NONE', 'PERCENT', 'AMOUNT')),
    CHECK ("quantity" > 0),
    CHECK ("unitPrice" >= 0),
    CHECK ("mrp" >= 0),
    CHECK ("discountValue" >= 0),
    CHECK ("discountAmount" >= 0),
    CHECK ("invoiceDiscountAllocation" >= 0),
    CHECK ("taxableAmount" >= 0),
    CHECK ("lineTotal" >= 0),
    FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice"("id") ON DELETE CASCADE,
    FOREIGN KEY ("productId") REFERENCES "Product"("id"),
    FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id"),
    FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id"),
    FOREIGN KEY ("inventoryTransactionId") REFERENCES "InventoryTransaction"("id")
);

-- Indexes for SalesInvoiceLine
CREATE INDEX "SalesInvoiceLine_salesInvoiceId_idx" ON "SalesInvoiceLine"("salesInvoiceId");
CREATE INDEX "SalesInvoiceLine_productId_idx" ON "SalesInvoiceLine"("productId");
CREATE INDEX "SalesInvoiceLine_inventoryTransactionId_idx" ON "SalesInvoiceLine"("inventoryTransactionId");

-- 3. Create SalesPayment table (Structural only for Phase 6.3)
CREATE TABLE "SalesPayment" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "salesInvoiceId"  TEXT NOT NULL,
    "paymentMode"     TEXT NOT NULL,
    "amount"          REAL NOT NULL DEFAULT 0,
    "referenceNumber" TEXT,
    "paymentDate"     TEXT NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'CAPTURED',
    "notes"           TEXT,
    "idempotencyKey"  TEXT,
    "createdAt"       TEXT NOT NULL,

    CHECK ("paymentMode" IN ('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CREDIT')),
    CHECK ("status" IN ('CAPTURED', 'REVERSED')),
    CHECK ("amount" > 0), -- Reject zero-value payments
    FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice"("id") ON DELETE CASCADE
);

-- Indexes for SalesPayment
CREATE UNIQUE INDEX "SalesPayment_idempotencyKey_key" ON "SalesPayment"("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;
CREATE INDEX "SalesPayment_salesInvoiceId_idx" ON "SalesPayment"("salesInvoiceId");
CREATE INDEX "SalesPayment_paymentMode_idx" ON "SalesPayment"("paymentMode");
CREATE INDEX "SalesPayment_status_idx" ON "SalesPayment"("status");
