-- =============================================================================
-- Migration: 20260802190000_supplier_purchase_foundation
-- Smart Vyapar Phase 5 - Supplier and Purchase Foundation
-- =============================================================================

CREATE TABLE "Supplier" (
    "id"                     TEXT NOT NULL PRIMARY KEY,
    "supplierCode"           TEXT NOT NULL,
    "normalizedSupplierCode" TEXT NOT NULL,
    "name"                   TEXT NOT NULL,
    "normalizedName"         TEXT NOT NULL,
    "contactPerson"          TEXT,
    "phone"                  TEXT,
    "alternatePhone"         TEXT,
    "email"                  TEXT,
    "gstNumber"              TEXT,
    "panNumber"              TEXT,
    "addressLine1"           TEXT,
    "addressLine2"           TEXT,
    "city"                   TEXT,
    "state"                  TEXT,
    "postalCode"             TEXT,
    "country"                TEXT NOT NULL DEFAULT 'India',
    "paymentTermsDays"       INTEGER NOT NULL DEFAULT 0,
    "creditLimit"            REAL NOT NULL DEFAULT 0,
    "openingBalance"         REAL NOT NULL DEFAULT 0,
    "openingBalanceType"     TEXT NOT NULL DEFAULT 'NONE',
    "notes"                  TEXT,
    "isActive"               INTEGER NOT NULL DEFAULT 1,
    "createdAt"              TEXT NOT NULL,
    "updatedAt"              TEXT NOT NULL,
    "version"                INTEGER NOT NULL DEFAULT 1,
    CHECK ("paymentTermsDays" >= 0),
    CHECK ("creditLimit" >= 0),
    CHECK ("openingBalance" >= 0),
    CHECK ("openingBalanceType" IN ('PAYABLE','RECEIVABLE','NONE'))
);

CREATE UNIQUE INDEX "Supplier_normalizedSupplierCode_key" ON "Supplier"("normalizedSupplierCode");
CREATE INDEX "Supplier_normalizedName_idx" ON "Supplier"("normalizedName");
CREATE INDEX "Supplier_gstNumber_idx" ON "Supplier"("gstNumber");
CREATE INDEX "Supplier_phone_idx" ON "Supplier"("phone");
CREATE INDEX "Supplier_isActive_idx" ON "Supplier"("isActive");

CREATE TABLE "DocumentSequence" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "documentType"   TEXT NOT NULL,
    "financialYear"  TEXT NOT NULL,
    "prefix"         TEXT NOT NULL,
    "nextNumber"     INTEGER NOT NULL DEFAULT 1,
    "paddingLength"  INTEGER NOT NULL DEFAULT 6,
    "createdAt"      TEXT NOT NULL,
    "updatedAt"      TEXT NOT NULL,
    CHECK ("nextNumber" > 0),
    CHECK ("paddingLength" > 0)
);

CREATE UNIQUE INDEX "DocumentSequence_type_year_key"
    ON "DocumentSequence"("documentType", "financialYear");

CREATE TABLE "PurchaseInvoice" (
    "id"                    TEXT NOT NULL PRIMARY KEY,
    "shopId"                TEXT NOT NULL,
    "supplierId"            TEXT NOT NULL,
    "purchaseNumber"        TEXT NOT NULL,
    "supplierInvoiceNumber" TEXT,
    "invoiceDate"           TEXT NOT NULL,
    "dueDate"               TEXT,
    "status"                TEXT NOT NULL DEFAULT 'DRAFT',
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
    "notes"                 TEXT,
    "postedAt"              TEXT,
    "cancelledAt"           TEXT,
    "cancellationReason"    TEXT,
    "createdAt"             TEXT NOT NULL,
    "updatedAt"             TEXT NOT NULL,
    "version"               INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id"),
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id"),
    CHECK ("status" IN ('DRAFT','POSTED','CANCELLED')),
    CHECK ("invoiceDiscountType" IN ('NONE','PERCENT','AMOUNT')),
    CHECK ("invoiceDiscountValue" >= 0),
    CHECK ("subtotal" >= 0),
    CHECK ("lineDiscountTotal" >= 0),
    CHECK ("invoiceDiscountTotal" >= 0),
    CHECK ("taxableAmount" >= 0),
    CHECK ("grandTotal" >= 0),
    CHECK ("paidAmount" >= 0),
    CHECK ("outstandingAmount" >= 0)
);

CREATE UNIQUE INDEX "PurchaseInvoice_purchaseNumber_key" ON "PurchaseInvoice"("purchaseNumber");
CREATE UNIQUE INDEX "PurchaseInvoice_supplier_invoice_key"
    ON "PurchaseInvoice"("supplierId", "supplierInvoiceNumber")
    WHERE "supplierInvoiceNumber" IS NOT NULL AND "supplierInvoiceNumber" <> '';
CREATE INDEX "PurchaseInvoice_supplierId_idx" ON "PurchaseInvoice"("supplierId");
CREATE INDEX "PurchaseInvoice_status_idx" ON "PurchaseInvoice"("status");
CREATE INDEX "PurchaseInvoice_invoiceDate_idx" ON "PurchaseInvoice"("invoiceDate");
CREATE INDEX "PurchaseInvoice_dueDate_idx" ON "PurchaseInvoice"("dueDate");
CREATE INDEX "PurchaseInvoice_shopId_idx" ON "PurchaseInvoice"("shopId");

CREATE TABLE "PurchaseInvoiceLine" (
    "id"                     TEXT NOT NULL PRIMARY KEY,
    "purchaseInvoiceId"      TEXT NOT NULL,
    "productId"              TEXT NOT NULL,
    "productCodeSnapshot"    TEXT NOT NULL,
    "productNameSnapshot"    TEXT NOT NULL,
    "hsnSacCodeSnapshot"     TEXT,
    "taxRateId"              TEXT,
    "taxRateSnapshot"        REAL NOT NULL DEFAULT 0,
    "quantity"               REAL NOT NULL,
    "unitId"                 TEXT,
    "unitNameSnapshot"       TEXT,
    "unitPrice"              REAL NOT NULL DEFAULT 0,
    "mrp"                    REAL NOT NULL DEFAULT 0,
    "discountType"           TEXT NOT NULL DEFAULT 'NONE',
    "discountValue"          REAL NOT NULL DEFAULT 0,
    "discountAmount"         REAL NOT NULL DEFAULT 0,
    "taxableAmount"          REAL NOT NULL DEFAULT 0,
    "cgstRate"               REAL NOT NULL DEFAULT 0,
    "cgstAmount"             REAL NOT NULL DEFAULT 0,
    "sgstRate"               REAL NOT NULL DEFAULT 0,
    "sgstAmount"             REAL NOT NULL DEFAULT 0,
    "igstRate"               REAL NOT NULL DEFAULT 0,
    "igstAmount"             REAL NOT NULL DEFAULT 0,
    "cessRate"               REAL NOT NULL DEFAULT 0,
    "cessAmount"             REAL NOT NULL DEFAULT 0,
    "lineTotal"              REAL NOT NULL DEFAULT 0,
    "inventoryTransactionId" TEXT,
    "createdAt"              TEXT NOT NULL,
    "updatedAt"              TEXT NOT NULL,
    FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE CASCADE,
    FOREIGN KEY ("productId") REFERENCES "Product"("id"),
    FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id"),
    FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id"),
    FOREIGN KEY ("inventoryTransactionId") REFERENCES "InventoryTransaction"("id"),
    CHECK ("quantity" > 0),
    CHECK ("unitPrice" >= 0),
    CHECK ("mrp" >= 0),
    CHECK ("discountType" IN ('NONE','PERCENT','AMOUNT')),
    CHECK ("discountValue" >= 0),
    CHECK ("discountAmount" >= 0),
    CHECK ("taxableAmount" >= 0),
    CHECK ("lineTotal" >= 0)
);

CREATE INDEX "PurchaseInvoiceLine_purchaseInvoiceId_idx" ON "PurchaseInvoiceLine"("purchaseInvoiceId");
CREATE INDEX "PurchaseInvoiceLine_productId_idx" ON "PurchaseInvoiceLine"("productId");
CREATE INDEX "PurchaseInvoiceLine_inventoryTransactionId_idx" ON "PurchaseInvoiceLine"("inventoryTransactionId");

CREATE TABLE "SupplierLedgerEntry" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "supplierId"      TEXT NOT NULL,
    "shopId"          TEXT NOT NULL,
    "entryType"       TEXT NOT NULL,
    "referenceType"   TEXT NOT NULL,
    "referenceId"     TEXT NOT NULL,
    "referenceNumber" TEXT,
    "debitAmount"     REAL NOT NULL DEFAULT 0,
    "creditAmount"    REAL NOT NULL DEFAULT 0,
    "occurredAt"      TEXT NOT NULL,
    "notes"           TEXT,
    "createdAt"       TEXT NOT NULL,
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id"),
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id"),
    CHECK ("entryType" IN ('OPENING_BALANCE','PURCHASE','PURCHASE_CANCELLATION','PAYMENT','PURCHASE_RETURN','ADJUSTMENT')),
    CHECK ("debitAmount" >= 0),
    CHECK ("creditAmount" >= 0),
    CHECK (("debitAmount" > 0 AND "creditAmount" = 0) OR ("creditAmount" > 0 AND "debitAmount" = 0) OR ("debitAmount" = 0 AND "creditAmount" = 0))
);

CREATE INDEX "SupplierLedgerEntry_supplierId_idx" ON "SupplierLedgerEntry"("supplierId");
CREATE INDEX "SupplierLedgerEntry_shopId_idx" ON "SupplierLedgerEntry"("shopId");
CREATE INDEX "SupplierLedgerEntry_occurredAt_idx" ON "SupplierLedgerEntry"("occurredAt");
CREATE INDEX "SupplierLedgerEntry_reference_idx" ON "SupplierLedgerEntry"("referenceType", "referenceId");
