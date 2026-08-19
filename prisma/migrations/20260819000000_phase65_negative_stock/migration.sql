-- AlterTable for Shop
ALTER TABLE "Shop" ADD COLUMN "allowNegativeStockGlobally" INTEGER NOT NULL DEFAULT 0;

-- AlterTable for Product
ALTER TABLE "Product" ADD COLUMN "negativeStockPolicy" TEXT NOT NULL DEFAULT 'INHERIT';

-- Data migration: migrate legacy allowNegativeStock to new policy
UPDATE "Product" SET "negativeStockPolicy" = 'ALLOW' WHERE "allowNegativeStock" = 1;
UPDATE "Product" SET "negativeStockPolicy" = 'INHERIT' WHERE "allowNegativeStock" = 0;
