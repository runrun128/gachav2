-- AlterTable
ALTER TABLE "Character" ADD COLUMN "soldAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TradeListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "characterId" TEXT,
    "itemKey" TEXT,
    "itemQuantity" INTEGER,
    "price" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TradeListing_sellerId_idx" ON "TradeListing"("sellerId");

-- AddForeignKey
ALTER TABLE "TradeListing" ADD CONSTRAINT "TradeListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
