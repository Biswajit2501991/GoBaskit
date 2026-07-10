-- Recoverable staff password vault (All Super Admin only)
ALTER TABLE "staff_accounts" ADD COLUMN IF NOT EXISTS "password_vault" TEXT;
