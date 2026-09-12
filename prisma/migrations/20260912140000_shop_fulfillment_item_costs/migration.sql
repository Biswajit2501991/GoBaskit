-- AlterTable
ALTER TABLE "shop_fulfillments" ADD COLUMN "cost_confirmed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "shop_fulfillment_items" ADD COLUMN "cost_to_gobaskit" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Existing tickets stay locked so live shops keep current behaviour.
UPDATE "shop_fulfillments" SET "cost_confirmed_at" = "created_at" WHERE "cost_confirmed_at" IS NULL;
