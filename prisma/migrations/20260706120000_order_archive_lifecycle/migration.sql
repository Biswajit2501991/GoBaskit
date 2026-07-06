-- Order archive lifecycle: admin archive, 24h customer visibility, 72h retention
ALTER TABLE "orders" ADD COLUMN "archived_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "customer_visible_until" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "purge_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "cancel_notice" TEXT;
ALTER TABLE "orders" ADD COLUMN "sms_sent_at" TIMESTAMP(3);

CREATE INDEX "orders_archived_at_purge_at_idx" ON "orders"("archived_at", "purge_at");

CREATE TABLE "customer_notices" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "order_id" TEXT,
    "message" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_notices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_notices_mobile_expires_at_idx" ON "customer_notices"("mobile", "expires_at");
