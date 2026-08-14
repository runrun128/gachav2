import { BattleRoom } from "./types";

export function roomToStateDTO(room: BattleRoom) {
  const [p1, p2] = room.userIds;
  return {
    roomId: room.id,
    phase: room.phase,
    roundNo: room.roundNo,
    settings: room.settings,
    log: room.log,
    roundSteps: room.lastRoundSteps,
    winnerUserId: room.winnerUserId,
    rewards: room.rewards,
    spectatorCount: room.spectatorIds.size,
    chatLog: room.chatLog,
    players: [p1, p2].map((pid) => {
      const f = room.fighters[pid];
      return {
        userId: pid,
        characterSelected: !!f,
        actionSubmitted: !!room.pending[pid],
        fighter: f
          ? {
              displayName: f.displayName,
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
            }
          : null,
      };
    }),
  };
}

export type BattleStateDTO = ReturnType<typeof roomToStateDTO>;
