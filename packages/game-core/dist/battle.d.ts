import { Rarity } from "./rarities.js";
export interface RarityBaseStats {
    hp: number;
    atk: number;
    def: number;
    spd: number;
}
export declare const RARITY_BASE_STATS: Record<Rarity, RarityBaseStats>;
export declare const GAMBLE_SUCCESS_CHANCE = 2;
export declare const GAMBLE_COOLDOWN_ROUNDS = 3;
export declare const GAMBLE_RECOIL_PERCENT = 0.1;
export declare const SPECIAL_COOLDOWN_ROUNDS = 3;
export declare const SPECIAL_SHIELD_ROUNDS = 2;
export declare const SPECIAL_ATTACK_MULTIPLIER = 1.8;
export declare const ATK_DEBUFF_MULT = 0.8;
export declare const ATK_DEBUFF_ROUNDS = 2;
export declare const DEFEND_DAMAGE_MULT = 0.55;
export declare const DEFEND_HEAL_PERCENT = 0.08;
export declare const BURN_DAMAGE_PERCENT = 0.08;
export declare const BATTLE_WIN_REWARD = 300;
export declare const BATTLE_LOSE_REWARD = 80;
export declare const BATTLE_DRAW_REWARD = 150;
export declare const MAX_BATTLE_ROUNDS = 15;
export declare const ROUND_ACTION_TIMEOUT_MS = 45000;
export declare const CHARACTER_SELECT_TIMEOUT_MS = 45000;
export declare const CHALLENGE_TIMEOUT_MS = 30000;
export declare const ROUND_INTERMISSION_MS = 2600;
export declare const STEP_REPLAY_MS = 2000;
export declare const STEP_REPLAY_BUFFER_MS = 600;
export type BattleAction = {
    type: "attack";
} | {
    type: "defend";
} | {
    type: "special";
} | {
    type: "gamble";
} | {
    type: "item";
    itemKey: string;
} | {
    type: "retire";
};
