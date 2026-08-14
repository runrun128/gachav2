export type Rarity = "N" | "R" | "SR" | "SSR" | "UR" | "MUR";
export interface RarityInfo {
    name: string;
    weight: number;
    color: string;
    emoji: string;
}
export declare const RARITIES: Record<Rarity, RarityInfo>;
export declare const RARITY_ORDER: Rarity[];
export declare function rarityIndex(rarity: Rarity): number;
export declare function isSecretFeatureRarity(rarity: Rarity): boolean;
