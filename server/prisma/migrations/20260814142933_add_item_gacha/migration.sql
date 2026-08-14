-- CreateTable
CREATE TABLE "ItemGachaConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "cost" INTEGER NOT NULL DEFAULT 300,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ItemGachaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemGachaEntry" (
    "id" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemGachaEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemGachaEntry_itemKey_key" ON "ItemGachaEntry"("itemKey");

-- SeedData: シングルトン設定行 + デフォルトの抽選プール(運営が管理画面から後で自由に編集/削除できる)
INSERT INTO "ItemGachaConfig" ("id", "cost", "active") VALUES ('singleton', 300, true)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ItemGachaEntry" ("id", "itemKey", "weight") VALUES
  ('seed_bone_fragment', 'bone_fragment', 30),
  ('seed_torn_web', 'torn_web', 30),
  ('seed_frozen_shard', 'frozen_shard', 25),
  ('seed_gale_feather', 'gale_feather', 15),
  ('seed_curse_crystal', 'curse_crystal', 15),
  ('seed_life_drop', 'life_drop', 15),
  ('seed_dragon_scale', 'dragon_scale', 5),
  ('seed_absolute_barrier', 'absolute_barrier', 5),
  ('seed_myth_shard', 'myth_shard', 1),
  ('seed_sand_of_time', 'sand_of_time', 1)
ON CONFLICT ("itemKey") DO NOTHING;

