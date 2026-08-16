-- CreateTable
CREATE TABLE "LimitedBonus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "coinAmount" INTEGER,
    "itemKey" TEXT,
    "itemAmount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LimitedBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LimitedBonusClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "limitedBonusId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LimitedBonusClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LimitedBonus_startsAt_endsAt_idx" ON "LimitedBonus"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "LimitedBonusClaim_userId_idx" ON "LimitedBonusClaim"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LimitedBonusClaim_userId_limitedBonusId_key" ON "LimitedBonusClaim"("userId", "limitedBonusId");

-- AddForeignKey
ALTER TABLE "LimitedBonusClaim" ADD CONSTRAINT "LimitedBonusClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LimitedBonusClaim" ADD CONSTRAINT "LimitedBonusClaim_limitedBonusId_fkey" FOREIGN KEY ("limitedBonusId") REFERENCES "LimitedBonus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
