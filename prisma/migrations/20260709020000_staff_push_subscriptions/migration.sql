-- Admin Web Push subscriptions for background new-order alerts.

CREATE TABLE "staff_push_subscriptions" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_push_subscriptions_endpoint_key" ON "staff_push_subscriptions"("endpoint");
CREATE INDEX "staff_push_subscriptions_staff_id_idx" ON "staff_push_subscriptions"("staff_id");

ALTER TABLE "staff_push_subscriptions" ADD CONSTRAINT "staff_push_subscriptions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
