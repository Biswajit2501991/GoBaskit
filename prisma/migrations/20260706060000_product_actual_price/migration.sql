-- Add optional MRP / actual price; migrate legacy discount model to selling + actual price.
ALTER TABLE "products" ADD COLUMN "actual_price" DOUBLE PRECISION;

UPDATE "products"
SET
  "actual_price" = "price",
  "price" = ROUND(("price" * (1 - "discount" / 100))::numeric, 2)
WHERE "discount" > 0;
