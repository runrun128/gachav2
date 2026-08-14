import { Rarity, SpecialType } from "@identity-slot/game-core";

export type ActionType = "attack" | "defend" | "special" | "gamble" | "item";

export interface PendingAction {
  type: ActionType;
  itemKey?: string;
}

export interface BattleFighter {
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
  retired: boolean;
}

export interface BattleSettings {
  maxRounds: number;
  itemsAllowed: boolean;
}

export interface RoundStep {
  /** この時点で room.log は何行まで確定しているか(絶対インデックス) */
  upToLine: number;
  /** このステップ終了時点の各ファイターのHP(userId をキーとする) */
  hp: Record<string, number>;
}

export interface ChatMessage {
  userId: string;
  displayName: string;
  text: string;
  at: number;
}

export interface BattleRoom {
  id: string;
  createdAt: number;
  userIds: [string, string];
  fighters: Partial<Record<string, BattleFighter>>;
  phase: "select" | "round" | "finished";
  roundNo: number;
  pending: Partial<Record<string, PendingAction>>;
  log: string[];
  lastRoundSteps: RoundStep[];
  winnerUserId: string | "draw" | null;
  rewards: Partial<Record<string, number>>;
  roundTimer: NodeJS.Timeout | null;
  selectTimer: NodeJS.Timeout | null;
  resolving: boolean;
  settings: BattleSettings;
  spectatorIds: Set<string>;
  spectatorNames: Record<string, string>;
  chatLog: ChatMessage[];
}

export interface PendingChallenge {
  id: string;
  fromUserId: string;
  fromDisplayName: string;
  toUserId: string;
  toDisplayName: string;
  expiresAt: number;
  timer: NodeJS.Timeout;
  settings: BattleSettings;
}
