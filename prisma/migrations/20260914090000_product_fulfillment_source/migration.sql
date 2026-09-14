-- CreateEnum
CREATE TYPE "ProductFulfillmentSource" AS ENUM ('UNSET', 'IN_HOUSE', 'OUTSOURCE');

-- AlterTable
ALTER TABLE "products" ADD COLUMN "fulfillment_source" "ProductFulfillmentSource" NOT NULL DEFAULT 'UNSET',
ADD COLUMN "cost_price" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN "fulfillment_source" "ProductFulfillmentSource" NOT NULL DEFAULT 'UNSET',
ADD COLUMN "cost_price" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "fulfillment_source" "ProductFulfillmentSource" NOT NULL DEFAULT 'UNSET',
ADD COLUMN "cost_price_snapshot" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "products_fulfillment_source_idx" ON "products"("fulfillment_source");
