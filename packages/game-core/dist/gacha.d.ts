import { Rarity } from "./rarities.js";
import { SpecialType } from "./traits.js";
export declare const STARTING_MONEY = 1000;
export declare const GACHA_COST = 100;
export declare const GACHA10_COST = 900;
export declare const GACHA_SR_COST = 500;
export declare const GACHA_SSR_COST = 1800;
export declare const GACHA_COOLDOWN_SECONDS = 4;
export declare const MAX_TRAIN_LEVEL = 10;
export declare const TRAIN_BASE_COST = 100;
export declare const LEVEL_STAT_BONUS_PER_LEVEL = 0.05;
export declare const SETSPECIAL_COST = 300;
export type GachaPullType = "single" | "ten" | "sr" | "ssr";
export declare function costForPullType(type: GachaPullType): number;
export declare function minRarityForPullType(type: GachaPullType): Rarity | undefined;
export interface SpinResult {
    nationality: string;
    age: number;
    gender: string;
    feature: string;
    rarity: Rarity;
    secretFeature: string | null;
    specialType: SpecialType | null;
}
export declare function chooseRarity(minRarity?: Rarity, rng?: () => number): Rarity;
export declare function spinReels(minRarity?: Rarity, rng?: () => number): SpinResult;
export declare function trainCost(level: number): number;
