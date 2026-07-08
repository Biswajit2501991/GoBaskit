-- Per-option (variant) product details, shown on the product page for the
-- selected option (falls back to the parent product's details when empty).
ALTER TABLE "product_variants" ADD COLUMN "details" TEXT NOT NULL DEFAULT '';
