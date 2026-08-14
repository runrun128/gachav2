-- CreateTable
CREATE TABLE "ItemShopOverride" (
    "itemKey" TEXT NOT NULL,
    "purchasable" BOOLEAN NOT NULL,
    "price" INTEGER,
    "tier" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemShopOverride_pkey" PRIMARY KEY ("itemKey")
);
