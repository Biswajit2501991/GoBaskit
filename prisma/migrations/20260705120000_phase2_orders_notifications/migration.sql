-- CreateEnum
CREATE TYPE "OrderPriority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "assigned_staff_id" TEXT,
ADD COLUMN "locked_at" TIMESTAMP(3),
ADD COLUMN "priority" "OrderPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "admin_notes" TEXT;

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "staff_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_notifications" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orders_assigned_staff_id_idx" ON "orders"("assigned_staff_id");
CREATE INDEX "orders_priority_created_at_idx" ON "orders"("priority", "created_at");
CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");
CREATE INDEX "admin_notifications_staff_id_read_at_created_at_idx" ON "admin_notifications"("staff_id", "read_at", "created_at");
CREATE INDEX "admin_notifications_created_at_idx" ON "admin_notifications"("created_at");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id") REFERENCES "staff_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admin_notifications" ADD CONSTRAINT "admin_notifications_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
