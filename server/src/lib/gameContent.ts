import { FEATURES, FEATURE_STAT_BONUS, ITEMS, ItemDef, ItemEffect, ItemTier } from "@identity-slot/game-core";
import { prisma } from "./prisma";

// game-core の ITEMS/FEATURES/FEATURE_STAT_BONUS はプレーンなオブジェクト/配列としてexportされているため、
// サーバー起動時と運営が追加/削除するたびにその場でmutateして反映する。
// game-core側やバトル/レイドの各所は今まで通りITEMS[key]・FEATURESを直接参照するだけでよく、
// 独自コンテンツに対応するための変更が既存コードに一切不要になる。

function toItemDef(row: {
  key: string;
  name: string;
  emoji: string;
  price: number | null;
  purchasable: boolean;
  tier: string;
  description: string;
  effect: string;
  value: number;
}): ItemDef {
  return {
    key: row.key,
    name: row.name,
    emoji: row.emoji,
    price: row.price ?? undefined,
    purchasable: row.purchasable,
    tier: row.tier as ItemTier,
    desc: row.description,
    effect: row.effect as ItemEffect,
    value: row.value,
  };
}

function applyFeatureBonus(label: string, bonus: {
  hpBonus: number;
  atkBonus: number;
  defBonus: number;
  spdBonus: number;
  luckBonus: number;
}) {
  if (!FEATURES.includes(label)) FEATURES.push(label);
  const b: Record<string, number> = {};
  if (bonus.hpBonus) b.hp = bonus.hpBonus;
  if (bonus.atkBonus) b.atk = bonus.atkBonus;
  if (bonus.defBonus) b.def = bonus.defBonus;
  if (bonus.spdBonus) b.spd = bonus.spdBonus;
  if (bonus.luckBonus) b.luck = bonus.luckBonus;
  FEATURE_STAT_BONUS[label] = b;
}

/** サーバー起動時に運営追加分のアイテム/特徴/ショップ設定をロードして反映する */
export async function loadCustomGameContent() {
  const [items, features, shopOverrides] = await Promise.all([
    prisma.customItem.findMany(),
    prisma.customFeature.findMany(),
    prisma.itemShopOverride.findMany(),
  ]);
  for (const item of items) applyCustomItem(item);
  for (const feature of features) applyFeatureBonus(feature.label, feature);
  for (const override of shopOverrides) applyShopOverride(override);
}

/** 標準アイテム(game-core組み込み分)のショップ設定を運営が変更した直後に呼び、即座に反映する */
export function applyShopOverride(row: { itemKey: string; purchasable: boolean; price: number | null; tier: string }) {
  const item = ITEMS[row.itemKey];
  if (!item) return;
  item.purchasable = row.purchasable;
  item.price = row.price ?? undefined;
  item.tier = row.tier as ItemTier;
}

/** 運営がアイテムを追加/編集した直後に呼び、再起動なしで即座に反映する */
export function applyCustomItem(row: Parameters<typeof toItemDef>[0]) {
  ITEMS[row.key] = toItemDef(row);
}

export function removeCustomItem(key: string) {
  delete ITEMS[key];
}

/** 運営が趣味を追加した直後に呼び、再起動なしで即座に反映する */
export function applyCustomFeature(row: {
  label: string;
  hpBonus: number;
  atkBonus: number;
  defBonus: number;
  spdBonus: number;
  luckBonus: number;
}) {
  applyFeatureBonus(row.label, row);
}

export function removeCustomFeature(label: string) {
  const idx = FEATURES.indexOf(label);
  if (idx >= 0) FEATURES.splice(idx, 1);
  delete FEATURE_STAT_BONUS[label];
}
