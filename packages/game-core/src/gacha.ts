import { RARITIES, RARITY_ORDER, Rarity, isSecretFeatureRarity } from "./rarities.js";
import { NATIONALITIES, GENDERS, FEATURES, SECRET_FEATURES, SpecialType, defaultSpecialTypeFor } from "./traits.js";

export const STARTING_MONEY = 1000;
export const GACHA_COST = 100;
export const GACHA10_COST = 900;
export const GACHA_SR_COST = 500;
export const GACHA_SSR_COST = 1800;
export const GACHA_COOLDOWN_SECONDS = 4;

export const MAX_TRAIN_LEVEL = 10;
export const TRAIN_BASE_COST = 100;
export const LEVEL_STAT_BONUS_PER_LEVEL = 0.05;

export const SETSPECIAL_COST = 300;

export type GachaPullType = "single" | "ten" | "sr" | "ssr";

export function costForPullType(type: GachaPullType): number {
  switch (type) {
    case "single":
      return GACHA_COST;
    case "ten":
      return GACHA10_COST;
    case "sr":
      return GACHA_SR_COST;
    case "ssr":
      return GACHA_SSR_COST;
  }
}

export function minRarityForPullType(type: GachaPullType): Rarity | undefined {
  if (type === "sr") return "SR";
  if (type === "ssr") return "SSR";
  return undefined;
}

export interface SpinResult {
  nationality: string;
  age: number;
  gender: string;
  feature: string;
  rarity: Rarity;
  secretFeature: string | null;
  specialType: SpecialType | null;
}

export function chooseRarity(minRarity?: Rarity, rng: () => number = Math.random): Rarity {
  const rarities = minRarity ? RARITY_ORDER.slice(RARITY_ORDER.indexOf(minRarity)) : RARITY_ORDER;
  const weights = rarities.map((r) => RARITIES[r].weight);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < rarities.length; i++) {
    if (roll < weights[i]) return rarities[i];
    roll -= weights[i];
  }
  return rarities[rarities.length - 1];
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function spinReels(minRarity?: Rarity, rng: () => number = Math.random): SpinResult {
  const rarity = chooseRarity(minRarity, rng);
  const hasSecret = isSecretFeatureRarity(rarity);
  const secretFeature = hasSecret ? pick(SECRET_FEATURES, rng) : null;
  return {
    nationality: pick(NATIONALITIES, rng),
    age: 1 + Math.floor(rng() * 82),
    gender: pick(GENDERS, rng),
    feature: pick(FEATURES, rng),
    rarity,
    secretFeature,
    specialType: secretFeature ? defaultSpecialTypeFor(secretFeature) : null,
  };
}

export function trainCost(level: number): number {
  return TRAIN_BASE_COST * level;
}
