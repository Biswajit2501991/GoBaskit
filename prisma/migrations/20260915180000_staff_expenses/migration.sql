-- Staff operating expenses. Additive; no changes to orders or existing settings rows.
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "note" TEXT NOT NULL DEFAULT '',
    "incurred_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "expenses_deleted_at_incurred_at_idx" ON "expenses"("deleted_at", "incurred_at");
CREATE INDEX "expenses_created_by_id_idx" ON "expenses"("created_by_id");

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
