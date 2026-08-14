-- CreateTable
CREATE TABLE "CustomItem" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "price" INTEGER,
    "purchasable" BOOLEAN NOT NULL DEFAULT false,
    "tier" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "effect" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFeature" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hpBonus" INTEGER NOT NULL DEFAULT 0,
    "atkBonus" INTEGER NOT NULL DEFAULT 0,
    "defBonus" INTEGER NOT NULL DEFAULT 0,
    "spdBonus" INTEGER NOT NULL DEFAULT 0,
    "luckBonus" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomFeature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomItem_key_key" ON "CustomItem"("key");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFeature_label_key" ON "CustomFeature"("label");

