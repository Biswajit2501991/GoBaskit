-- CreateEnum
CREATE TYPE "WhatsAppVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN "is_whatsapp_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customers" ADD COLUMN "verified_at" TIMESTAMP(3);
ALTER TABLE "customers" ADD COLUMN "verified_by" TEXT;

-- CreateTable
CREATE TABLE "customer_mobiles" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "is_whatsapp_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_mobiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_verifications" (
    "id" TEXT NOT NULL,
    "customer_mobile_id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "verification_code" TEXT NOT NULL,
    "status" "WhatsAppVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "customer_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,

    CONSTRAINT "whatsapp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_audit_logs" (
    "id" TEXT NOT NULL,
    "mobile" TEXT,
    "verification_id" TEXT,
    "action" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_mobiles_mobile_key" ON "customer_mobiles"("mobile");

-- CreateIndex
CREATE INDEX "customers_mobile_idx" ON "customers"("mobile");

-- CreateIndex
CREATE INDEX "whatsapp_verifications_mobile_status_idx" ON "whatsapp_verifications"("mobile", "status");

-- CreateIndex
CREATE INDEX "whatsapp_verifications_verification_code_idx" ON "whatsapp_verifications"("verification_code");

-- CreateIndex
CREATE INDEX "whatsapp_verifications_status_created_at_idx" ON "whatsapp_verifications"("status", "created_at");

-- CreateIndex
CREATE INDEX "verification_audit_logs_mobile_created_at_idx" ON "verification_audit_logs"("mobile", "created_at");

-- CreateIndex
CREATE INDEX "verification_audit_logs_verification_id_idx" ON "verification_audit_logs"("verification_id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "staff_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_mobiles" ADD CONSTRAINT "customer_mobiles_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "staff_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_verifications" ADD CONSTRAINT "whatsapp_verifications_customer_mobile_id_fkey" FOREIGN KEY ("customer_mobile_id") REFERENCES "customer_mobiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_verifications" ADD CONSTRAINT "whatsapp_verifications_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "staff_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
