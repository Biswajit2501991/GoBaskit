-- Health Star Rating (1–5) on products and product options (variants).
ALTER TABLE "products" ADD COLUMN "health_star_rating" INTEGER;
ALTER TABLE "product_variants" ADD COLUMN "health_star_rating" INTEGER;
