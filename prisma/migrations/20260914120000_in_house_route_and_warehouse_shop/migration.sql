-- CreateEnum
CREATE TYPE "OrderItemFulfillmentRoute" AS ENUM ('IN_HOUSE', 'SHOP');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "fulfillment_route" "OrderItemFulfillmentRoute";

-- AlterTable
ALTER TABLE "shops" ADD COLUMN "is_internal" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "shops_is_internal_idx" ON "shops"("is_internal");

-- Warehouse shop for In House tickets (hidden from shop login / catalog tagging).
INSERT INTO "shops" ("id", "name", "phone", "address", "city", "active", "is_internal", "created_at", "updated_at")
SELECT 'clgobaskitinhouse001', 'GoBaskit In House', '0000000000', '', '', true, true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "shops" WHERE "is_internal" = true);
