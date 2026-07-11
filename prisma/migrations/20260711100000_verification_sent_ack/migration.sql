-- AlterTable
ALTER TABLE "whatsapp_verifications" ADD COLUMN IF NOT EXISTS "sent_acknowledged_at" TIMESTAMP(3);
