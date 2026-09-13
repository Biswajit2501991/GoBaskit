-- AlterTable
ALTER TABLE "products" ADD COLUMN "previous_price" DOUBLE PRECISION,
ADD COLUMN "earlier_price" DOUBLE PRECISION,
ADD COLUMN "previous_price_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN "previous_price" DOUBLE PRECISION,
ADD COLUMN "earlier_price" DOUBLE PRECISION,
ADD COLUMN "previous_price_at" TIMESTAMP(3);
