-- Customer Web Push subscriptions for out-for-delivery alerts.

CREATE TABLE "customer_push_subscriptions" (
    "id" TEXT NOT NULL,
    "customer_mobile_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_push_subscriptions_endpoint_key" ON "customer_push_subscriptions"("endpoint");
CREATE INDEX "customer_push_subscriptions_customer_mobile_id_idx" ON "customer_push_subscriptions"("customer_mobile_id");

ALTER TABLE "customer_push_subscriptions" ADD CONSTRAINT "customer_push_subscriptions_customer_mobile_id_fkey" FOREIGN KEY ("customer_mobile_id") REFERENCES "customer_mobiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
