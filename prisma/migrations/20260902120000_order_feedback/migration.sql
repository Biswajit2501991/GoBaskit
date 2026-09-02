CREATE TABLE "order_feedback" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "customer_mobile" TEXT NOT NULL,
    "stars" INTEGER,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_feedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_feedback_order_id_key" ON "order_feedback"("order_id");
CREATE INDEX "order_feedback_created_at_idx" ON "order_feedback"("created_at");
CREATE INDEX "order_feedback_skipped_stars_idx" ON "order_feedback"("skipped", "stars");

ALTER TABLE "order_feedback" ADD CONSTRAINT "order_feedback_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
