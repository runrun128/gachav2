import { TournamentBracketSize } from "@identity-slot/game-core";
import { BattleFighter } from "../battle/types";

export type TournamentPhase = "lobby" | "select" | "running" | "finished";

export interface TournamentMatch {
  id: string;
  player1Id: string;
  player2Id: string;
  winnerId: string | null;
  log: string[];
}

export interface TournamentRoom {
  id: string;
  roomName: string;
  hostUserId: string;
  bracketSize: TournamentBracketSize;
  phase: TournamentPhase;
  participantIds: string[];
  participantNames: Record<string, string>;
  // キャラクター選択直後に組んだ基準ステータス(各試合の開始時にHP/クールダウンをここから作り直す)
  fighterTemplates: Partial<Record<string, BattleFighter>>;
  // rounds[0] = 1回戦, rounds[1] = 準決勝 ... 各要素はその回戦の試合一覧
  rounds: TournamentMatch[][];
  currentRound: number;
  championId: string | null;
  runnerUpId: string | null;
  finishReason: string | null;
  rewards: Partial<Record<string, number>>;
  createdAt: number;
  selectTimer: NodeJS.Timeout | null;
}
