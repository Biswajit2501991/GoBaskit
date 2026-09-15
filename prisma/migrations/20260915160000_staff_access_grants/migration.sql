-- Per-staff admin page ticks and reusable access roles. Existing staff keep NULL grants (role defaults).
CREATE TABLE "access_roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "grants" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "access_roles_name_key" ON "access_roles"("name");

ALTER TABLE "staff_accounts" ADD COLUMN "access_grants" JSONB,
ADD COLUMN "access_role_id" TEXT;

CREATE INDEX "staff_accounts_access_role_id_idx" ON "staff_accounts"("access_role_id");

ALTER TABLE "staff_accounts" ADD CONSTRAINT "staff_accounts_access_role_id_fkey" FOREIGN KEY ("access_role_id") REFERENCES "access_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
