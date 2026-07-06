-- Automatic inventory: baseline for 25% alerts, order stock reservation flag
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "stock_baseline" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "low_stock_notified_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "stock_reserved" BOOLEAN NOT NULL DEFAULT false;

-- Existing products: baseline = current stock
UPDATE "products" SET "stock_baseline" = GREATEST("stock", "stock_baseline") WHERE "stock_baseline" = 0;
