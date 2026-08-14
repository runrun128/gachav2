import { Rarity } from "./rarities.js";

export interface RarityBaseStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

// v4のDiscord版と同じ値(レアリティ間のステータス差を圧縮したバランス)
export const RARITY_BASE_STATS: Record<Rarity, RarityBaseStats> = {
  N: { hp: 90, atk: 14, def: 10, spd: 12 },
  R: { hp: 105, atk: 17, def: 12, spd: 14 },
  SR: { hp: 120, atk: 20, def: 14, spd: 16 },
  SSR: { hp: 135, atk: 24, def: 17, spd: 19 },
  UR: { hp: 150, atk: 28, def: 20, spd: 22 },
  MUR: { hp: 170, atk: 32, def: 23, spd: 25 },
};

export const GAMBLE_SUCCESS_CHANCE = 2; // %
export const GAMBLE_COOLDOWN_ROUNDS = 3;
export const GAMBLE_RECOIL_PERCENT = 0.1;

export const SPECIAL_COOLDOWN_ROUNDS = 3;
export const SPECIAL_SHIELD_ROUNDS = 2;
export const SPECIAL_ATTACK_MULTIPLIER = 1.8;

export const ATK_DEBUFF_MULT = 0.8;
export const ATK_DEBUFF_ROUNDS = 2;

export const DEFEND_DAMAGE_MULT = 0.55;
export const DEFEND_HEAL_PERCENT = 0.08;
export const BURN_DAMAGE_PERCENT = 0.08;

export const BATTLE_WIN_REWARD = 300;
export const BATTLE_LOSE_REWARD = 80;
export const BATTLE_DRAW_REWARD = 150;

export const MAX_BATTLE_ROUNDS = 15;
export const ROUND_ACTION_TIMEOUT_MS = 45_000;
export const CHARACTER_SELECT_TIMEOUT_MS = 45_000;
export const CHALLENGE_TIMEOUT_MS = 30_000;
// ラウンド結果を見せてから次のラウンドを開始するまでの最低時間(ステップが無い場合のフォールバック)
export const ROUND_INTERMISSION_MS = 2_600;
// 1アクター(1手)の結果を見せてから次のアクターの結果を見せるまでの間隔。
// クライアント側の再生タイミングとサーバー側の「次のラウンドまで待つ時間」の両方で使う共有値。
export const STEP_REPLAY_MS = 2_000;
// 全ステップ再生後、次のラウンドへ移るまでの余白
export const STEP_REPLAY_BUFFER_MS = 600;

export type BattleAction =
  | { type: "attack" }
  | { type: "defend" }
  | { type: "special" }
  | { type: "gamble" }
  | { type: "item"; itemKey: string }
  | { type: "retire" };
