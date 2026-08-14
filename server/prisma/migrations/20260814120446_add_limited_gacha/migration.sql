-- CreateTable
CREATE TABLE "LimitedGacha" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LimitedGacha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LimitedGacha_key_key" ON "LimitedGacha"("key");

-- SeedData: リリース記念ガチャ(運営が管理画面から手動でactiveを切り替えて終了させる)
INSERT INTO "LimitedGacha" ("id", "key", "name", "description", "cost", "active")
VALUES (
  'seed_release_gacha',
  'release',
  '🎉 リリース記念ガチャ',
  'NEO ORACLE ARCADEリリースを記念した期間限定ガチャ。1回引くと必ず期間限定の記念キャラが手に入ります。',
  1500,
  true
)
ON CONFLICT ("key") DO NOTHING;

