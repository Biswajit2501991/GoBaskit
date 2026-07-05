-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('SUPER_ADMIN', 'MANAGER', 'ORDER_MANAGER', 'INVENTORY_MANAGER', 'DELIVERY_MANAGER', 'CUSTOMER_SUPPORT', 'FINANCE', 'MARKETING', 'READ_ONLY', 'CUSTOM');

-- CreateTable
CREATE TABLE "staff_accounts" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'READ_ONLY',
    "password_hash" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_refresh_tokens" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "remember_me" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_login_attempts" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entity_id" TEXT,
    "meta" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_accounts_mobile_key" ON "staff_accounts"("mobile");
CREATE UNIQUE INDEX "staff_accounts_email_key" ON "staff_accounts"("email");
CREATE INDEX "staff_accounts_mobile_idx" ON "staff_accounts"("mobile");
CREATE INDEX "staff_accounts_role_active_idx" ON "staff_accounts"("role", "active");
CREATE INDEX "staff_accounts_deleted_at_idx" ON "staff_accounts"("deleted_at");

CREATE INDEX "staff_refresh_tokens_staff_id_idx" ON "staff_refresh_tokens"("staff_id");
CREATE INDEX "staff_refresh_tokens_expires_at_idx" ON "staff_refresh_tokens"("expires_at");

CREATE INDEX "staff_login_attempts_mobile_created_at_idx" ON "staff_login_attempts"("mobile", "created_at");

CREATE INDEX "audit_logs_staff_id_created_at_idx" ON "audit_logs"("staff_id", "created_at");
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "staff_refresh_tokens" ADD CONSTRAINT "staff_refresh_tokens_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
