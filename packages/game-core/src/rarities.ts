export type Rarity = "N" | "R" | "SR" | "SSR" | "UR" | "MUR";

export interface RarityInfo {
  name: string;
  weight: number;
  color: string;
  emoji: string;
}

export const RARITIES: Record<Rarity, RarityInfo> = {
  N: { name: "NORMAL", weight: 60, color: "#808080", emoji: "⚪" },
  R: { name: "RARE", weight: 25, color: "#3498DB", emoji: "🔵" },
  SR: { name: "SUPER RARE", weight: 10, color: "#9B59B6", emoji: "🟣" },
  SSR: { name: "SUPER SUPER RARE", weight: 4, color: "#F1C40F", emoji: "🟡" },
  UR: { name: "ULTRA RARE", weight: 1, color: "#E74C3C", emoji: "🔴" },
  MUR: { name: "MYTH ULTRA RARE", weight: 0.08, color: "#00FFD1", emoji: "🌈" },
};

export const RARITY_ORDER: Rarity[] = ["N", "R", "SR", "SSR", "UR", "MUR"];

export function rarityIndex(rarity: Rarity): number {
  return RARITY_ORDER.indexOf(rarity);
}

export function isSecretFeatureRarity(rarity: Rarity): boolean {
  return rarity === "SSR" || rarity === "UR" || rarity === "MUR";
}
