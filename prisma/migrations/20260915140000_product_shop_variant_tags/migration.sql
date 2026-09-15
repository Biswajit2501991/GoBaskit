-- Tag shops per website option (parent + each size), not only the parent product.
ALTER TABLE "product_shops" ADD COLUMN "variant_id" TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS "product_shops_product_id_shop_id_key";
ALTER TABLE "product_shops" DROP CONSTRAINT IF EXISTS "product_shops_product_id_shop_id_key";

CREATE UNIQUE INDEX "product_shops_product_id_shop_id_variant_id_key"
  ON "product_shops" ("product_id", "shop_id", "variant_id");

CREATE INDEX "product_shops_variant_id_idx" ON "product_shops" ("variant_id");

-- Existing shop tags keep covering every active size, same as before this change.
INSERT INTO "product_shops" ("id", "product_id", "shop_id", "variant_id")
SELECT gen_random_uuid()::text, ps."product_id", ps."shop_id", pv."id"
FROM "product_shops" ps
INNER JOIN "product_variants" pv
  ON pv."product_id" = ps."product_id" AND pv."is_active" = true
WHERE ps."variant_id" = ''
ON CONFLICT ("product_id", "shop_id", "variant_id") DO NOTHING;
