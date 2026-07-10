-- CreateTable
CREATE TABLE "customer_wishlist_items" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_key" TEXT NOT NULL DEFAULT '',
    "variant_id" TEXT,
    "notify_on_restock" BOOLEAN NOT NULL DEFAULT true,
    "awaiting_restock" BOOLEAN NOT NULL DEFAULT false,
    "last_notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_restock_notices" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_restock_notices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_wishlist_items_mobile_created_at_idx" ON "customer_wishlist_items"("mobile", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "customer_wishlist_items_mobile_product_id_variant_key_key" ON "customer_wishlist_items"("mobile", "product_id", "variant_key");

-- CreateIndex
CREATE INDEX "customer_restock_notices_mobile_read_at_expires_at_idx" ON "customer_restock_notices"("mobile", "read_at", "expires_at");

-- AddForeignKey
ALTER TABLE "customer_wishlist_items" ADD CONSTRAINT "customer_wishlist_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
