-- =============================================================================
-- Migration: 20260802120000_product_master
-- Smart Vyapar Phase 3 — Product Master Foundation
-- Tables: UnitOfMeasure, ProductCategory, Brand, TaxRate,
--         PriceBook, Product, ProductBarcode, ProductPrice,
--         StorePriceBook, InventoryOpeningBalance
-- =============================================================================

-- 1. UnitOfMeasure ----------------------------------------------------------
CREATE TABLE "UnitOfMeasure" (
    "id"               TEXT NOT NULL PRIMARY KEY,
    "name"             TEXT NOT NULL,
    "shortName"        TEXT NOT NULL,
    "normalizedName"   TEXT NOT NULL,
    "normalizedShortName" TEXT NOT NULL,
    "decimalAllowed"   INTEGER NOT NULL DEFAULT 0,
    "decimalPlaces"    INTEGER NOT NULL DEFAULT 0,
    "isActive"         INTEGER NOT NULL DEFAULT 1,
    "createdAt"        TEXT NOT NULL,
    "updatedAt"        TEXT NOT NULL
);

CREATE UNIQUE INDEX "UnitOfMeasure_normalizedName_key"      ON "UnitOfMeasure"("normalizedName");
CREATE UNIQUE INDEX "UnitOfMeasure_normalizedShortName_key" ON "UnitOfMeasure"("normalizedShortName");
CREATE INDEX        "UnitOfMeasure_isActive_idx"            ON "UnitOfMeasure"("isActive");

-- Seed common units (idempotent via INSERT OR IGNORE)
INSERT OR IGNORE INTO "UnitOfMeasure"
    ("id","name","shortName","normalizedName","normalizedShortName","decimalAllowed","decimalPlaces","isActive","createdAt","updatedAt")
VALUES
    ('uom-pcs','Piece','PCS','piece','pcs',0,0,1,datetime('now'),datetime('now')),
    ('uom-kg', 'Kilogram','KG','kilogram','kg',1,3,1,datetime('now'),datetime('now')),
    ('uom-gm', 'Gram','GM','gram','gm',1,3,1,datetime('now'),datetime('now')),
    ('uom-ltr','Litre','LTR','litre','ltr',1,3,1,datetime('now'),datetime('now')),
    ('uom-ml', 'Millilitre','ML','millilitre','ml',1,3,1,datetime('now'),datetime('now')),
    ('uom-box','Box','BOX','box','box',0,0,1,datetime('now'),datetime('now')),
    ('uom-pkt','Pack','PKT','pack','pkt',0,0,1,datetime('now'),datetime('now')),
    ('uom-mtr','Meter','MTR','meter','mtr',1,3,1,datetime('now'),datetime('now'));

-- 2. ProductCategory --------------------------------------------------------
CREATE TABLE "ProductCategory" (
    "id"               TEXT NOT NULL PRIMARY KEY,
    "name"             TEXT NOT NULL,
    "normalizedName"   TEXT NOT NULL,
    "description"      TEXT,
    "parentCategoryId" TEXT,
    "displayOrder"     INTEGER NOT NULL DEFAULT 0,
    "isActive"         INTEGER NOT NULL DEFAULT 1,
    "createdAt"        TEXT NOT NULL,
    "updatedAt"        TEXT NOT NULL,
    FOREIGN KEY ("parentCategoryId") REFERENCES "ProductCategory"("id")
);

-- Uniqueness: name within same parent (NULL parent treated as root)
CREATE UNIQUE INDEX "ProductCategory_normalizedName_parent_key"
    ON "ProductCategory"("normalizedName","parentCategoryId")
    WHERE "parentCategoryId" IS NOT NULL;
CREATE UNIQUE INDEX "ProductCategory_normalizedName_root_key"
    ON "ProductCategory"("normalizedName")
    WHERE "parentCategoryId" IS NULL;
CREATE INDEX "ProductCategory_parentCategoryId_idx" ON "ProductCategory"("parentCategoryId");
CREATE INDEX "ProductCategory_isActive_idx"          ON "ProductCategory"("isActive");

-- 3. Brand ------------------------------------------------------------------
CREATE TABLE "Brand" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "name"           TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description"    TEXT,
    "isActive"       INTEGER NOT NULL DEFAULT 1,
    "createdAt"      TEXT NOT NULL,
    "updatedAt"      TEXT NOT NULL
);

CREATE UNIQUE INDEX "Brand_normalizedName_key" ON "Brand"("normalizedName");
CREATE INDEX        "Brand_isActive_idx"        ON "Brand"("isActive");

-- 4. TaxRate ----------------------------------------------------------------
CREATE TABLE "TaxRate" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "name"          TEXT NOT NULL,
    "rate"          REAL NOT NULL DEFAULT 0,
    "taxType"       TEXT NOT NULL DEFAULT 'GST',
    "cgstRate"      REAL NOT NULL DEFAULT 0,
    "sgstRate"      REAL NOT NULL DEFAULT 0,
    "igstRate"      REAL NOT NULL DEFAULT 0,
    "cessRate"      REAL NOT NULL DEFAULT 0,
    "effectiveFrom" TEXT NOT NULL,
    "effectiveTo"   TEXT,
    "isActive"      INTEGER NOT NULL DEFAULT 1,
    "createdAt"     TEXT NOT NULL,
    "updatedAt"     TEXT NOT NULL
);

CREATE INDEX "TaxRate_taxType_idx"  ON "TaxRate"("taxType");
CREATE INDEX "TaxRate_isActive_idx" ON "TaxRate"("isActive");

-- Seed GST slabs (deterministic IDs, idempotent)
INSERT OR IGNORE INTO "TaxRate"
    ("id","name","rate","taxType","cgstRate","sgstRate","igstRate","cessRate","effectiveFrom","isActive","createdAt","updatedAt")
VALUES
    ('tax-exempt','Exempt','0','EXEMPT',0,0,0,0,'2017-07-01',1,datetime('now'),datetime('now')),
    ('tax-gst-0', 'GST 0%','0','GST',0,0,0,0,'2017-07-01',1,datetime('now'),datetime('now')),
    ('tax-gst-5', 'GST 5%','5','GST',2.5,2.5,5,0,'2017-07-01',1,datetime('now'),datetime('now')),
    ('tax-gst-12','GST 12%','12','GST',6,6,12,0,'2017-07-01',1,datetime('now'),datetime('now')),
    ('tax-gst-18','GST 18%','18','GST',9,9,18,0,'2017-07-01',1,datetime('now'),datetime('now')),
    ('tax-gst-28','GST 28%','28','GST',14,14,28,0,'2017-07-01',1,datetime('now'),datetime('now')),
    ('tax-zero',  'Zero Rated','0','ZERO_RATED',0,0,0,0,'2017-07-01',1,datetime('now'),datetime('now')),
    ('tax-nongst','Non GST','0','NON_GST',0,0,0,0,'2017-07-01',1,datetime('now'),datetime('now'));

-- 5. PriceBook --------------------------------------------------------------
CREATE TABLE "PriceBook" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "name"        TEXT NOT NULL,
    "code"        TEXT NOT NULL,
    "description" TEXT,
    "isDefault"   INTEGER NOT NULL DEFAULT 0,
    "isActive"    INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" TEXT,
    "effectiveTo"   TEXT,
    "createdAt"   TEXT NOT NULL,
    "updatedAt"   TEXT NOT NULL
);

CREATE UNIQUE INDEX "PriceBook_code_key"       ON "PriceBook"("code");
CREATE INDEX        "PriceBook_isDefault_idx"  ON "PriceBook"("isDefault");
CREATE INDEX        "PriceBook_isActive_idx"   ON "PriceBook"("isActive");

-- Seed default PriceBook (deterministic ID)
INSERT OR IGNORE INTO "PriceBook"
    ("id","name","code","description","isDefault","isActive","createdAt","updatedAt")
VALUES
    ('pricebook-default','Standard Price List','DEFAULT','Default price book for standard retail pricing',1,1,datetime('now'),datetime('now'));

-- 6. Product ----------------------------------------------------------------
CREATE TABLE "Product" (
    "id"                  TEXT NOT NULL PRIMARY KEY,
    "productCode"         TEXT NOT NULL,
    "normalizedProductCode" TEXT NOT NULL,
    "name"                TEXT NOT NULL,
    "normalizedName"      TEXT NOT NULL,
    "printName"           TEXT,
    "description"         TEXT,
    "categoryId"          TEXT,
    "brandId"             TEXT,
    "primaryUnitId"       TEXT NOT NULL,
    "hsnSacCode"          TEXT,
    "taxRateId"           TEXT,
    "productType"         TEXT NOT NULL DEFAULT 'GOODS',
    "trackInventory"      INTEGER NOT NULL DEFAULT 1,
    "allowNegativeStock"  INTEGER NOT NULL DEFAULT 0,
    "minimumStockLevel"   REAL,
    "reorderLevel"        REAL,
    "maximumStockLevel"   REAL,
    "sku"                 TEXT,
    "normalizedSku"       TEXT,
    -- Derived convenience cache columns (updated ONLY by PricingService)
    -- Source of truth is ProductPrice table via default PriceBook
    "cachedPurchasePrice"  REAL,
    "cachedSellingPrice"   REAL,
    "cachedMrp"            REAL,
    "cachedWholesalePrice" REAL,
    "isActive"            INTEGER NOT NULL DEFAULT 1,
    "version"             INTEGER NOT NULL DEFAULT 1,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    FOREIGN KEY ("categoryId")    REFERENCES "ProductCategory"("id"),
    FOREIGN KEY ("brandId")       REFERENCES "Brand"("id"),
    FOREIGN KEY ("primaryUnitId") REFERENCES "UnitOfMeasure"("id"),
    FOREIGN KEY ("taxRateId")     REFERENCES "TaxRate"("id")
);

CREATE UNIQUE INDEX "Product_normalizedProductCode_key" ON "Product"("normalizedProductCode");
CREATE UNIQUE INDEX "Product_normalizedSku_key"         ON "Product"("normalizedSku") WHERE "normalizedSku" IS NOT NULL;
CREATE INDEX        "Product_normalizedName_idx"        ON "Product"("normalizedName");
CREATE INDEX        "Product_categoryId_idx"            ON "Product"("categoryId");
CREATE INDEX        "Product_brandId_idx"               ON "Product"("brandId");
CREATE INDEX        "Product_taxRateId_idx"             ON "Product"("taxRateId");
CREATE INDEX        "Product_isActive_idx"              ON "Product"("isActive");
CREATE INDEX        "Product_productType_idx"           ON "Product"("productType");
CREATE INDEX        "Product_hsnSacCode_idx"            ON "Product"("hsnSacCode");

-- 7. ProductBarcode ---------------------------------------------------------
CREATE TABLE "ProductBarcode" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "productId"   TEXT NOT NULL,
    "barcode"     TEXT NOT NULL,
    "barcodeType" TEXT NOT NULL DEFAULT 'EAN13',
    "isPrimary"   INTEGER NOT NULL DEFAULT 0,
    "isActive"    INTEGER NOT NULL DEFAULT 1,
    "createdAt"   TEXT NOT NULL,
    "updatedAt"   TEXT NOT NULL,
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
);

CREATE UNIQUE INDEX "ProductBarcode_barcode_key"     ON "ProductBarcode"("barcode");
CREATE INDEX        "ProductBarcode_productId_idx"   ON "ProductBarcode"("productId");
CREATE INDEX        "ProductBarcode_isPrimary_idx"   ON "ProductBarcode"("isPrimary");
CREATE INDEX        "ProductBarcode_isActive_idx"    ON "ProductBarcode"("isActive");

-- 8. ProductPrice -----------------------------------------------------------
CREATE TABLE "ProductPrice" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "productId"      TEXT NOT NULL,
    "priceBookId"    TEXT NOT NULL,
    "purchasePrice"  REAL NOT NULL DEFAULT 0,
    "sellingPrice"   REAL NOT NULL DEFAULT 0,
    "mrp"            REAL NOT NULL DEFAULT 0,
    "wholesalePrice" REAL,
    "effectiveFrom"  TEXT NOT NULL,
    "effectiveTo"    TEXT,
    "isActive"       INTEGER NOT NULL DEFAULT 1,
    "createdAt"      TEXT NOT NULL,
    "updatedAt"      TEXT NOT NULL,
    FOREIGN KEY ("productId")   REFERENCES "Product"("id"),
    FOREIGN KEY ("priceBookId") REFERENCES "PriceBook"("id")
);

CREATE INDEX "ProductPrice_productId_priceBookId_idx" ON "ProductPrice"("productId","priceBookId");
CREATE INDEX "ProductPrice_isActive_idx"              ON "ProductPrice"("isActive");
CREATE INDEX "ProductPrice_effectiveFrom_idx"         ON "ProductPrice"("effectiveFrom");

-- 9. StorePriceBook ---------------------------------------------------------
CREATE TABLE "StorePriceBook" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "shopId"       TEXT NOT NULL,
    "priceBookId"  TEXT NOT NULL,
    "priority"     INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" TEXT NOT NULL,
    "effectiveTo"  TEXT,
    "isActive"     INTEGER NOT NULL DEFAULT 1,
    "createdAt"    TEXT NOT NULL,
    "updatedAt"    TEXT NOT NULL,
    FOREIGN KEY ("shopId")      REFERENCES "Shop"("id"),
    FOREIGN KEY ("priceBookId") REFERENCES "PriceBook"("id")
);

CREATE INDEX "StorePriceBook_shopId_idx"      ON "StorePriceBook"("shopId");
CREATE INDEX "StorePriceBook_priceBookId_idx" ON "StorePriceBook"("priceBookId");
CREATE INDEX "StorePriceBook_isActive_idx"    ON "StorePriceBook"("isActive");

-- Assign existing shops to the default PriceBook idempotently.
INSERT OR IGNORE INTO "StorePriceBook"
    ("id","shopId","priceBookId","priority","effectiveFrom","isActive","createdAt","updatedAt")
SELECT
    'store-pricebook-default-' || "id",
    "id",
    'pricebook-default',
    1,
    date('now'),
    1,
    datetime('now'),
    datetime('now')
FROM "Shop";

-- 10. InventoryOpeningBalance -----------------------------------------------
CREATE TABLE "InventoryOpeningBalance" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "productId"  TEXT NOT NULL,
    "shopId"     TEXT NOT NULL,
    "quantity"   REAL NOT NULL DEFAULT 0,
    "unitCost"   REAL NOT NULL DEFAULT 0,
    "recordedAt" TEXT NOT NULL,
    "reference"  TEXT,
    "createdAt"  TEXT NOT NULL,
    FOREIGN KEY ("productId") REFERENCES "Product"("id"),
    FOREIGN KEY ("shopId")    REFERENCES "Shop"("id")
);

CREATE UNIQUE INDEX "InventoryOpeningBalance_productId_shopId_key"
    ON "InventoryOpeningBalance"("productId","shopId");
CREATE INDEX "InventoryOpeningBalance_productId_idx" ON "InventoryOpeningBalance"("productId");
CREATE INDEX "InventoryOpeningBalance_shopId_idx"    ON "InventoryOpeningBalance"("shopId");
