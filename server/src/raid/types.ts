import { BossKey, Rarity, SpecialType } from "@identity-slot/game-core";
import { PendingAction } from "../battle/types";

export interface RaidFighter {
  userId: string;
  displayName: string;
  characterId: string;
  nationality: string;
  age: number;
  gender: string;
  feature: string;
  rarity: Rarity;
  level: number;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  luck: number;
  hasSpecial: boolean;
  specialType: SpecialType | null;
  moveName: string;
  specialCooldown: number;
  hasGamble: boolean;
  gambleCooldown: number;
  atkDebuffRounds: number;
  invincibleRounds: number;
  shieldPartialRounds: number;
  shieldPartialValue: number;
  poisonRounds: number;
  burnRounds: number;
  silencedRounds: number;
  frozen: boolean;
  retired: boolean;
}

export interface RaidBoss {
  key: BossKey;
  name: string;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  enraged: boolean;
  roarUsed: boolean;
  healedOnce: boolean;
  shieldRounds: number;
  shieldUsed: boolean;
  atkDebuffRounds: number;
  poisonRounds: number;
}

export type RaidPhase = "lobby" | "select" | "round" | "finished";

export interface RaidRoundStep {
  /** この時点で room.log は何行まで確定しているか(絶対インデックス) */
  upToLine: number;
  /** このステップ終了時点の各参加者のHP(userId をキーとする) */
  participantHp: Record<string, number>;
  /** このステップ終了時点のボスのHP */
  bossHp: number;
}

export interface RaidRoom {
  id: string;
  roomName: string;
  bossKey: BossKey;
  hostUserId: string;
  phase: RaidPhase;
  participantIds: string[];
  participantNames: Record<string, string>;
  boss: RaidBoss | null;
  fighters: Partial<Record<string, RaidFighter>>;
  roundNo: number;
  pending: Partial<Record<string, PendingAction>>;
  log: string[];
  lastRoundSteps: RaidRoundStep[];
  frozenThisRound: Set<string>;
  damageDealt: Record<string, number>;
  winner: boolean | null; // true=討伐成功 false=討伐失敗 null=未決着
  finishReason: string | null;
  rewards: Partial<Record<string, number>>;
  drops: Partial<Record<string, { itemKey: string; name: string; emoji: string }>>;
  mvpUserId: string | null;
  createdAt: number;
  selectTimer: NodeJS.Timeout | null;
  roundTimer: NodeJS.Timeout | null;
  resolving: boolean;
}
