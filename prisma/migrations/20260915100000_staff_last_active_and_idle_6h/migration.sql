-- Sliding staff idle timeout: last real activity, plus bump the old 15-minute default to 6 hours.
ALTER TABLE "staff_accounts" ADD COLUMN "last_active_at" TIMESTAMP(3);

UPDATE "staff_accounts"
SET "last_active_at" = COALESCE("last_login", "updated_at")
WHERE "last_active_at" IS NULL;

UPDATE "settings"
SET "value" = '360'
WHERE "key" = 'staff_idle_timeout_minutes'
  AND "value" = '15';
