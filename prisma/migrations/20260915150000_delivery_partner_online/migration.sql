-- AlterEnum
ALTER TYPE "StaffRole" ADD VALUE IF NOT EXISTS 'DELIVERY_PARTNER';

-- AlterTable
ALTER TABLE "staff_accounts" ADD COLUMN "delivery_online" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "staff_accounts" ADD COLUMN "delivery_online_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "staff_accounts_role_delivery_online_active_idx" ON "staff_accounts"("role", "delivery_online", "active");
