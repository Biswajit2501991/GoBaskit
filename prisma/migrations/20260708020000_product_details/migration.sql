-- Add configurable product details (long-form specs shown in an expandable
-- section on the product page). Defaults to empty so existing rows are safe.
ALTER TABLE "products" ADD COLUMN "details" TEXT NOT NULL DEFAULT '';
