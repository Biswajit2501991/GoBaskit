-- CreateEnum
CREATE TYPE "ShopOfferStatus" AS ENUM ('OPEN', 'EXPIRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ShopFulfillmentStatus" AS ENUM ('ACCEPTED', 'PICKED', 'CANCELLED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "assignment_frozen_at" TIMESTAMP(3),
ADD COLUMN "delivery_confirmed_by_id" TEXT;

-- AlterTable
ALTER TABLE "staff_accounts" ADD COLUMN "shop_id" TEXT;

-- CreateTable
CREATE TABLE "shops" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_shops" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,

    CONSTRAINT "product_shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_delivery_pins" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "pin_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_delivery_pins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_offers" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "status" "ShopOfferStatus" NOT NULL DEFAULT 'OPEN',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "pickup_hint" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_offer_skips" (
    "id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,

    CONSTRAINT "shop_offer_skips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_fulfillments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "suffix" TEXT NOT NULL,
    "status" "ShopFulfillmentStatus" NOT NULL DEFAULT 'ACCEPTED',
    "pickup_at" TIMESTAMP(3) NOT NULL,
    "cost_to_gobaskit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accepted_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_fulfillments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_fulfillment_items" (
    "id" TEXT NOT NULL,
    "fulfillment_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "shop_fulfillment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_item_claims" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "fulfillment_id" TEXT NOT NULL,

    CONSTRAINT "shop_item_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shops_active_idx" ON "shops"("active");

-- CreateIndex
CREATE UNIQUE INDEX "product_shops_product_id_shop_id_key" ON "product_shops"("product_id", "shop_id");

-- CreateIndex
CREATE INDEX "product_shops_shop_id_idx" ON "product_shops"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_delivery_pins_order_id_key" ON "order_delivery_pins"("order_id");

-- CreateIndex
CREATE INDEX "shop_offers_order_id_status_idx" ON "shop_offers"("order_id", "status");

-- CreateIndex
CREATE INDEX "shop_offers_status_expires_at_idx" ON "shop_offers"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "shop_offer_skips_offer_id_shop_id_key" ON "shop_offer_skips"("offer_id", "shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "shop_fulfillments_order_id_suffix_key" ON "shop_fulfillments"("order_id", "suffix");

-- CreateIndex
CREATE INDEX "shop_fulfillments_shop_id_status_idx" ON "shop_fulfillments"("shop_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "shop_fulfillment_items_fulfillment_id_order_item_id_key" ON "shop_fulfillment_items"("fulfillment_id", "order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "shop_item_claims_order_item_id_key" ON "shop_item_claims"("order_item_id");

-- CreateIndex
CREATE INDEX "shop_item_claims_shop_id_idx" ON "shop_item_claims"("shop_id");

-- CreateIndex
CREATE INDEX "staff_accounts_shop_id_idx" ON "staff_accounts"("shop_id");

-- CreateIndex
CREATE INDEX "orders_delivery_confirmed_by_id_idx" ON "orders"("delivery_confirmed_by_id");

-- AddForeignKey
ALTER TABLE "staff_accounts" ADD CONSTRAINT "staff_accounts_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_confirmed_by_id_fkey" FOREIGN KEY ("delivery_confirmed_by_id") REFERENCES "staff_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_shops" ADD CONSTRAINT "product_shops_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_shops" ADD CONSTRAINT "product_shops_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_delivery_pins" ADD CONSTRAINT "order_delivery_pins_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_offers" ADD CONSTRAINT "shop_offers_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_offer_skips" ADD CONSTRAINT "shop_offer_skips_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "shop_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_offer_skips" ADD CONSTRAINT "shop_offer_skips_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_fulfillments" ADD CONSTRAINT "shop_fulfillments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_fulfillments" ADD CONSTRAINT "shop_fulfillments_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_fulfillments" ADD CONSTRAINT "shop_fulfillments_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "staff_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_fulfillment_items" ADD CONSTRAINT "shop_fulfillment_items_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "shop_fulfillments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_fulfillment_items" ADD CONSTRAINT "shop_fulfillment_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_item_claims" ADD CONSTRAINT "shop_item_claims_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_item_claims" ADD CONSTRAINT "shop_item_claims_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "shop_fulfillments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
