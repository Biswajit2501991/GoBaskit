-- Promote owner account now that ALL_SUPER_ADMIN exists
UPDATE "staff_accounts"
SET
  "role" = 'ALL_SUPER_ADMIN',
  "name" = 'All Super Admin',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "mobile" = '7899813212'
  AND "deleted_at" IS NULL;
