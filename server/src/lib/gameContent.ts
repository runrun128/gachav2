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

/** サーバー起動時に運営追加分のアイテム/特徴をロードして反映する */
export async function loadCustomGameContent() {
  const [items, features] = await Promise.all([prisma.customItem.findMany(), prisma.customFeature.findMany()]);
  for (const item of items) applyCustomItem(item);
  for (const feature of features) applyFeatureBonus(feature.label, feature);
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
