export type ItemEffect = "heal" | "attack_multiplier" | "invincible_1" | "invincible_n" | "priority_attack" | "shield_partial_1" | "enemy_atk_down" | "poison" | "nuke_and_full_heal" | "extra_turn";
export type ItemTier = "shop" | "common" | "uncommon" | "rare" | "legendary";
export interface ItemDef {
    key: string;
    name: string;
    emoji: string;
    price?: number;
    purchasable: boolean;
    tier: ItemTier;
    desc: string;
    effect: ItemEffect;
    value: number;
}
export declare const ITEMS: Record<string, ItemDef>;
export declare const PURCHASABLE_ITEMS: ItemDef[];
export declare const BOSS_ITEM_TIER_WEIGHTS: Record<Exclude<ItemTier, "shop">, number>;
/** ボス討伐時のアイテムドロップ抽選。レアな階層(tier)ほど出にくい。 */
export declare function chooseBossDropItem(rng?: () => number): string;
