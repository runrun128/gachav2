-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "grantedCharacterId" TEXT,
ADD COLUMN     "recipientUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Announcement_grantedCharacterId_key" ON "Announcement"("grantedCharacterId");

-- CreateIndex
CREATE INDEX "Announcement_recipientUserId_idx" ON "Announcement"("recipientUserId");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_grantedCharacterId_fkey" FOREIGN KEY ("grantedCharacterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

