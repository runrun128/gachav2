"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomToLobbySummary = roomToLobbySummary;
exports.roomToStateDTO = roomToStateDTO;
const game_core_1 = require("@identity-slot/game-core");
function roomToLobbySummary(room) {
    const info = game_core_1.BOSSES[room.bossKey];
    return {
        roomId: room.id,
        roomName: room.roomName,
        bossKey: room.bossKey,
        bossName: info.name,
        bossEmoji: info.emoji,
        hostUserId: room.hostUserId,
        hostDisplayName: room.participantNames[room.hostUserId] ?? "",
        participantCount: room.participantIds.length,
        maxParticipants: game_core_1.MAX_RAID_PARTICIPANTS,
    };
}
function roomToStateDTO(room) {
    const info = game_core_1.BOSSES[room.bossKey];
    return {
        roomId: room.id,
        roomName: room.roomName,
        bossKey: room.bossKey,
        bossName: info.name,
        bossEmoji: info.emoji,
        bossDesc: info.desc,
        hostUserId: room.hostUserId,
        phase: room.phase,
        roundNo: room.roundNo,
        log: room.log,
        roundSteps: room.lastRoundSteps,
        winner: room.winner,
        finishReason: room.finishReason,
        rewards: room.rewards,
        drops: room.drops,
        mvpUserId: room.mvpUserId,
        damageDealt: room.damageDealt,
        maxParticipants: game_core_1.MAX_RAID_PARTICIPANTS,
        boss: room.boss
            ? {
                hp: Math.max(0, room.boss.hp),
                maxHp: room.boss.maxHp,
                shieldRounds: room.boss.shieldRounds,
                weakPoint: room.phase === "round" && room.roundNo > 0 && room.roundNo % game_core_1.WEAKPOINT_EVERY === 0,
            }
            : null,
        participants: room.participantIds.map((pid) => {
            const f = room.fighters[pid];
            return {
                userId: pid,
                displayName: room.participantNames[pid] ?? "",
                characterSelected: !!f,
                actionSubmitted: !!room.pending[pid],
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
                        frozen: f.frozen,
                        burnRounds: f.burnRounds,
                        poisonRounds: f.poisonRounds,
                        silencedRounds: f.silencedRounds,
                        atkDebuffRounds: f.atkDebuffRounds,
                    }
                    : null,
            };
        }),
    };
}
