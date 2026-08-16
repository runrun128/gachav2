import { MAX_ROYALE_PARTICIPANTS, MIN_ROYALE_PARTICIPANTS } from "@identity-slot/game-core";
import { RoyaleRoom } from "./types";

export interface RoyaleLobbySummary {
  roomId: string;
  roomName: string;
  hostUserId: string;
  hostDisplayName: string;
  participantCount: number;
  maxParticipants: number;
}

export function roomToLobbySummary(room: RoyaleRoom): RoyaleLobbySummary {
  return {
    roomId: room.id,
    roomName: room.roomName,
    hostUserId: room.hostUserId,
    hostDisplayName: room.participantNames[room.hostUserId] ?? "",
    participantCount: room.participantIds.length,
    maxParticipants: MAX_ROYALE_PARTICIPANTS,
  };
}

export function roomToStateDTO(room: RoyaleRoom) {
  return {
    roomId: room.id,
    roomName: room.roomName,
    hostUserId: room.hostUserId,
    phase: room.phase,
    roundNo: room.roundNo,
    spectatorCount: room.spectatorIds.size,
    chatLog: room.chatLog,
    log: room.log,
    roundSteps: room.lastRoundSteps,
    winnerUserId: room.winnerUserId,
    finishReason: room.finishReason,
    rewards: room.rewards,
    maxParticipants: MAX_ROYALE_PARTICIPANTS,
    minParticipants: MIN_ROYALE_PARTICIPANTS,
    eliminationOrder: room.eliminationOrder,
    participants: room.participantIds.map((pid) => {
      const f = room.fighters[pid];
      return {
        userId: pid,
        displayName: room.participantNames[pid] ?? "",
        characterSelected: !!f,
        actionSubmitted: !!room.pending[pid],
        eliminated: room.eliminationOrder.includes(pid),
        fighter: f
          ? {
              nationality: f.nationality,
              age: f.age,
              gender: f.gender,
              feature: f.feature,
              rarity: f.rarity,
              level: f.level,
              maxHp: f.maxHp,
              hp: Math.max(0, f.hp),
              atk: f.atk,
              def: f.def,
              spd: f.spd,
              hasSpecial: f.hasSpecial,
              specialType: f.specialType,
              moveName: f.moveName,
              specialCooldown: f.specialCooldown,
              hasGamble: f.hasGamble,
              gambleCooldown: f.gambleCooldown,
              retired: f.retired,
              poisonRounds: f.poisonRounds,
              atkDebuffRounds: f.atkDebuffRounds,
              invincibleRounds: f.invincibleRounds,
            }
          : null,
      };
    }),
  };
}

export type RoyaleStateDTO = ReturnType<typeof roomToStateDTO>;
