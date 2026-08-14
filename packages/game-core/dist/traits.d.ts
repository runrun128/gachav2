export declare const NATIONALITIES: string[];
export declare const GENDERS: string[];
export declare const FEATURES: string[];
export declare const SECRET_FEATURES: string[];
export type SpecialType = "attack" | "heal" | "shield" | "debuff";
export interface SpecialTypeInfo {
    emoji: string;
    label: string;
    desc: string;
}
export declare const HEAL_SPECIAL_PERCENT_PVP = 0.5;
export declare const HEAL_SPECIAL_PERCENT_RAID = 0.3;
export declare const SPECIAL_TYPES: Record<SpecialType, SpecialTypeInfo>;
export declare const SPECIAL_TYPE_ORDER: SpecialType[];
/** 隠し特徴の文字列から決定的にとくぎ属性を割り当てる(旧データ互換用の簡易ハッシュ) */
export declare function defaultSpecialTypeFor(secretFeature: string): SpecialType;
export interface FeatureStatBonus {
    hp?: number;
    atk?: number;
    def?: number;
    spd?: number;
    luck?: number;
}
export declare const FEATURE_STAT_BONUS: Record<string, FeatureStatBonus>;
