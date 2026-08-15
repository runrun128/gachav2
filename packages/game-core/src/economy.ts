import { ItemDef, ItemTier } from "./items.js";
import { MAX_TRAIN_LEVEL } from "./gacha.js";
import { Rarity } from "./rarities.js";

// ガチャで引き直すより明確に損になる水準に抑え、ガチャ→売却の money 増殖を防ぐ。
// KMR/LTD(運営限定・期間限定記念)は0=売却不可(トレード/マーケット出品も同様に不可)。
export const CHARACTER_SELL_BASE: Record<Rarity, number> = {
  N: 20,
  R: 80,
  SR: 300,
  SSR: 1000,
  UR: 4000,
  MUR: 20000,
  KMR: 0,
  LTD: 0,
};

/** レベルに応じて最大+100%(Lv1で等倍、MAX_TRAIN_LEVELで2倍)。育成コストを多少は取り戻せるようにする。 */
export function characterSellPrice(rarity: Rarity, level: number): number {
  const base = CHARACTER_SELL_BASE[rarity];
  if (base <= 0) return 0;
  const clampedLevel = Math.min(Math.max(level, 1), MAX_TRAIN_LEVEL);
  const levelMultiplier = 1 + (clampedLevel - 1) / (MAX_TRAIN_LEVEL - 1);
  return Math.round(base * levelMultiplier);
}

export function isCharacterSellable(rarity: Rarity, isExclusive: boolean): boolean {
  return !isExclusive && CHARACTER_SELL_BASE[rarity] > 0;
}

const ITEM_TIER_SELL_BASE: Record<ItemTier, number> = {
  shop: 50,
  common: 20,
  uncommon: 50,
  rare: 150,
  legendary: 500,
};

/** 購入可能アイテムは価格の半額、ボスドロップ専用等の非売品はtierごとの基準値で買い取る。 */
export function itemSellPrice(item: Pick<ItemDef, "price" | "tier">): number {
  if (item.price) return Math.floor(item.price / 2);
  return ITEM_TIER_SELL_BASE[item.tier] ?? 20;
}

export const TRADE_INVITE_TIMEOUT_MS = 30_000;
export const TRADE_MAX_OFFER_CHARACTERS = 10;
export const TRADE_MAX_COINS = 1_000_000_000;
export const MARKET_MAX_PRICE = 1_000_000_000;
