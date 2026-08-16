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

// デイリーログインボーナス。7日サイクルで、最終日(7日目)にまとまったボーナスが付く。
export const DAILY_BONUS_CYCLE_DAYS = 7;
export const DAILY_BONUS_REWARDS: number[] = [100, 150, 200, 250, 300, 400, 800];

export function dailyBonusRewardForStreak(streak: number): number {
  const idx = Math.min(Math.max(streak, 1), DAILY_BONUS_CYCLE_DAYS) - 1;
  return DAILY_BONUS_REWARDS[idx];
}

function toUtcDateOnly(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export interface DailyBonusStatus {
  canClaim: boolean;
  /** 今クレームした場合に到達するstreak(まだ受け取っていない場合の見込み値) */
  nextStreak: number;
}

/**
 * lastClaimedAt(前回受け取り日時)とcurrentStreak(現在の連続日数)から、
 * 今日クレームできるか・できるなら次のstreakがいくつになるかを計算する。
 * 日付比較はUTC暦日単位(サーバーのタイムゾーンに依存しない)。
 */
export function computeDailyBonusStatus(
  lastClaimedAt: Date | null,
  currentStreak: number,
  now: Date = new Date()
): DailyBonusStatus {
  if (!lastClaimedAt) return { canClaim: true, nextStreak: 1 };

  const dayDiff = Math.round((toUtcDateOnly(now) - toUtcDateOnly(lastClaimedAt)) / (24 * 60 * 60 * 1000));

  if (dayDiff <= 0) return { canClaim: false, nextStreak: currentStreak };
  if (dayDiff === 1) {
    const nextStreak = currentStreak >= DAILY_BONUS_CYCLE_DAYS ? 1 : currentStreak + 1;
    return { canClaim: true, nextStreak };
  }
  return { canClaim: true, nextStreak: 1 };
}
