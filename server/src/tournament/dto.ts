import { TournamentRoom } from "./types";

export interface TournamentLobbySummary {
  roomId: string;
  roomName: string;
  bracketSize: number;
  hostUserId: string;
  hostDisplayName: string;
  participantCount: number;
}

export function roomToLobbySummary(room: TournamentRoom): TournamentLobbySummary {
  return {
    roomId: room.id,
    roomName: room.roomName,
    bracketSize: room.bracketSize,
    hostUserId: room.hostUserId,
    hostDisplayName: room.participantNames[room.hostUserId] ?? "",
    participantCount: room.participantIds.length,
  };
}

export function roomToStateDTO(room: TournamentRoom) {
  return {
    roomId: room.id,
    roomName: room.roomName,
    bracketSize: room.bracketSize,
    hostUserId: room.hostUserId,
    phase: room.phase,
    participantIds: room.participantIds,
    participantNames: room.participantNames,
    charactersSelected: Object.fromEntries(
      room.participantIds.map((pid) => [pid, !!room.fighterTemplates[pid]])
    ),
    currentRound: room.currentRound,
    rounds: room.rounds,
    championId: room.championId,
    runnerUpId: room.runnerUpId,
    finishReason: room.finishReason,
    rewards: room.rewards,
  };
}

export type TournamentStateDTO = ReturnType<typeof roomToStateDTO>;
