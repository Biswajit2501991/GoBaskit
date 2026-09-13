-- CreateEnum
CREATE TYPE "ShopPaymentStatus" AS ENUM ('UNSET', 'PAID', 'PENDING');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "shop_handover_pin_lookup" TEXT,
ADD COLUMN "shop_handover_pin_vault" TEXT,
ADD COLUMN "shop_handover_generated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "shop_fulfillments" ADD COLUMN "payment_status" "ShopPaymentStatus" NOT NULL DEFAULT 'UNSET',
ADD COLUMN "payment_marked_at" TIMESTAMP(3),
ADD COLUMN "handover_verified_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "orders_shop_handover_pin_lookup_key" ON "orders"("shop_handover_pin_lookup");

-- CreateIndex
CREATE INDEX "shop_fulfillments_shop_id_payment_status_idx" ON "shop_fulfillments"("shop_id", "payment_status");
