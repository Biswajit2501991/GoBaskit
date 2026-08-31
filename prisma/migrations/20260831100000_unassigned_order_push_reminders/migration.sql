-- Track unassigned-order push reminders (cron safety net). Existing rows stay 0 / null.

ALTER TABLE "orders" ADD COLUMN "unassigned_push_reminders" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "last_unassigned_push_at" TIMESTAMP(3);

CREATE INDEX "orders_assigned_staff_id_status_archived_at_idx" ON "orders"("assigned_staff_id", "status", "archived_at");
