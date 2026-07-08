-- Customer account passwords (login after WhatsApp verification).
ALTER TABLE "customer_mobiles" ADD COLUMN "password_hash" TEXT;
ALTER TABLE "customer_mobiles" ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "customer_mobiles" ADD COLUMN "locked_at" TIMESTAMP(3);
