-- AlterTable for SalesPayment
ALTER TABLE "SalesPayment" ADD COLUMN "paymentSource" TEXT NOT NULL DEFAULT 'SALE_CHECKOUT';
