-- CreateTable
CREATE TABLE "learning_notes" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "author_id" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learning_notes_updated_at_idx" ON "learning_notes"("updated_at");

-- AddForeignKey
ALTER TABLE "learning_notes" ADD CONSTRAINT "learning_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "staff_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_notes" ADD CONSTRAINT "learning_notes_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "staff_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
