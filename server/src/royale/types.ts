import { BattleFighter, ChatMessage } from "../battle/types";

export type RoyaleActionType = "attack" | "defend" | "special" | "gamble" | "item";

export interface RoyalePendingAction {
  type: RoyaleActionType;
  itemKey?: string;
  targetId?: string;
}

export interface RoyaleRoundStep {
  /** この時点で room.log は何行まで確定しているか(絶対インデックス) */
  upToLine: number;
  /** このステップ終了時点の各ファイターのHP(userId をキーとする) */
  participantHp: Record<string, number>;
  /** このステップで行動したファイターのuserId */
  actorId: string;
}

export type RoyalePhase = "lobby" | "select" | "round" | "finished";

export interface RoyaleRoom {
  id: string;
  roomName: string;
  hostUserId: string;
  phase: RoyalePhase;
  participantIds: string[];
  participantNames: Record<string, string>;
  fighters: Partial<Record<string, BattleFighter>>;
  roundNo: number;
  pending: Partial<Record<string, RoyalePendingAction>>;
  log: string[];
  lastRoundSteps: RoyaleRoundStep[];
  // 脱落順(先に脱落した人から順に並ぶ)。決着後、これを逆順にすると順位になる。
  eliminationOrder: string[];
  winnerUserId: string | null;
  finishReason: string | null;
  rewards: Partial<Record<string, number>>;
  createdAt: number;
  selectTimer: NodeJS.Timeout | null;
  roundTimer: NodeJS.Timeout | null;
  resolving: boolean;
  chatLog: ChatMessage[];
  spectatorIds: Set<string>;
  spectatorNames: Record<string, string>;
}
