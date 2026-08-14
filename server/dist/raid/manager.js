"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RaidManager = exports.UserFacingError = void 0;
const crypto_1 = require("crypto");
const game_core_1 = require("@identity-slot/game-core");
const prisma_1 = require("../lib/prisma");
const presence_1 = require("../socket/presence");
const dto_1 = require("./dto");
const engine_1 = require("./engine");
class UserFacingError extends Error {
}
exports.UserFacingError = UserFacingError;
class RaidManager {
    io;
    rooms = new Map();
    userRoom = new Map();
    constructor(io) {
        this.io = io;
    }
    createRoomShell(roomName, bossKey, hostUserId, hostDisplayName) {
        return {
            id: (0, crypto_1.randomUUID)(),
            roomName,
            bossKey,
            hostUserId,
            phase: "lobby",
            participantIds: [hostUserId],
            participantNames: { [hostUserId]: hostDisplayName },
            boss: null,
            fighters: {},
            roundNo: 0,
            pending: {},
            log: [],
            lastRoundSteps: [],
            frozenThisRound: new Set(),
            damageDealt: {},
            winner: null,
            finishReason: null,
            rewards: {},
            drops: {},
            mvpUserId: null,
            createdAt: Date.now(),
            selectTimer: null,
            roundTimer: null,
            resolving: false,
        };
    }
    async createLobby(hostUserId, roomName, bossKey) {
        const trimmed = roomName.trim();
        if (!trimmed)
            throw new UserFacingError("部屋の名前を入力してください。");
        if (trimmed.length > 30)
            throw new UserFacingError("部屋の名前は30文字以内にしてください。");
        if (this.userRoom.has(hostUserId))
            throw new UserFacingError("すでに別のレイドに参加中です。");
        if (!game_core_1.BOSSES[bossKey])
            throw new UserFacingError("ボスの指定が不正です。");
        const user = await prisma_1.prisma.user.findUnique({ where: { id: hostUserId } });
        if (!user)
            throw new UserFacingError("ユーザーが見つかりません。");
        const room = this.createRoomShell(trimmed, bossKey, hostUserId, user.displayName);
        this.rooms.set(room.id, room);
        this.userRoom.set(hostUserId, room.id);
        this.broadcastLobbies();
        return { roomId: room.id };
    }
    listLobbies() {
        return [...this.rooms.values()].filter((r) => r.phase === "lobby").map(dto_1.roomToLobbySummary);
    }
    broadcastLobbies() {
        this.io.emit("raid:lobbiesUpdated", { lobbies: this.listLobbies() });
    }
    async joinLobby(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (!room)
            throw new UserFacingError("レイドが見つかりません。");
        if (room.phase !== "lobby")
            throw new UserFacingError("すでに開始されたレイドです。");
        if (room.participantIds.includes(userId))
            return { roomId: room.id };
        if (room.participantIds.length >= game_core_1.MAX_RAID_PARTICIPANTS)
            throw new UserFacingError("満員です。");
        if (this.userRoom.has(userId))
            throw new UserFacingError("すでに別のレイドに参加中です。");
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new UserFacingError("ユーザーが見つかりません。");
        room.participantIds.push(userId);
        room.participantNames[userId] = user.displayName;
        this.userRoom.set(userId, room.id);
        this.broadcastState(room);
        this.broadcastLobbies();
        return { roomId: room.id };
    }
    joinRoom(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (!room)
            throw new UserFacingError("レイドが見つかりません。");
        if (!room.participantIds.includes(userId))
            throw new UserFacingError("このレイドの参加者ではありません。");
        this.sendState(room, userId);
    }
    async startRaid(roomId, byUserId) {
        const room = this.rooms.get(roomId);
        if (!room)
            throw new UserFacingError("レイドが見つかりません。");
        if (room.hostUserId !== byUserId)
            throw new UserFacingError("主催者のみが開始できます。");
        if (room.phase !== "lobby")
            throw new UserFacingError("すでに開始されています。");
        room.boss = (0, engine_1.buildBossFighter)(room.bossKey, room.participantIds.length);
        room.phase = "select";
        room.selectTimer = setTimeout(() => this.handleSelectTimeout(room.id), game_core_1.RAID_CHARACTER_SELECT_TIMEOUT_MS);
        this.broadcastState(room);
        this.broadcastLobbies();
    }
    async selectCharacter(roomId, userId, characterId) {
        const room = this.requireParticipant(roomId, userId);
        if (room.phase !== "select")
            throw new UserFacingError("現在はキャラクターを選択できません。");
        if (room.fighters[userId])
            throw new UserFacingError("すでに選択済みです。");
        const character = await prisma_1.prisma.character.findFirst({ where: { id: characterId, userId } });
        if (!character)
            throw new UserFacingError("キャラクターが見つかりません。");
        room.fighters[userId] = (0, engine_1.buildRaidFighter)(character, userId, room.participantNames[userId] ?? "プレイヤー");
        const allSelected = room.participantIds.every((pid) => !!room.fighters[pid]);
        if (allSelected) {
            if (room.selectTimer) {
                clearTimeout(room.selectTimer);
                room.selectTimer = null;
            }
            room.phase = "round";
            this.beginRound(room);
        }
        else {
            this.broadcastState(room);
        }
    }
    beginRound(room) {
        room.roundNo += 1;
        room.pending = {};
        if (room.roundNo > game_core_1.RAID_MAX_ROUNDS) {
            this.finish(room, false, "時間切れ").catch((err) => console.error("[raid finish]", err));
            return;
        }
        (0, engine_1.applyRoundStartEffects)(room);
        if (room.boss.hp <= 0) {
            this.finish(room, true).catch((err) => console.error("[raid finish]", err));
            return;
        }
        if ((0, engine_1.aliveParticipantIds)(room).length === 0) {
            this.finish(room, false, "全滅").catch((err) => console.error("[raid finish]", err));
            return;
        }
        const actionable = (0, engine_1.actionableParticipantIds)(room);
        if (actionable.length === 0) {
            this.resolveRoundNow(room);
            return;
        }
        room.roundTimer = setTimeout(() => this.handleRoundTimeout(room.id, room.roundNo), game_core_1.RAID_ROUND_ACTION_TIMEOUT_MS);
        this.broadcastState(room);
    }
    async submitAction(roomId, userId, action) {
        const room = this.requireParticipant(roomId, userId);
        if (room.phase !== "round")
            throw new UserFacingError("現在は行動を選択できません。");
        if (room.pending[userId])
            throw new UserFacingError("すでに行動を選択済みです。");
        const fighter = room.fighters[userId];
        if (!fighter || fighter.hp <= 0)
            throw new UserFacingError("行動できません。");
        if (room.frozenThisRound.has(userId))
            throw new UserFacingError("凍結中のため行動できません。");
        if (action.type === "special") {
            if (!fighter.hasSpecial || fighter.specialCooldown > 0)
                throw new UserFacingError("とくぎはまだ使えません。");
            if (fighter.silencedRounds > 0)
                throw new UserFacingError("封印されていて使えません。");
        }
        if (action.type === "gamble") {
            if (!fighter.hasGamble || fighter.gambleCooldown > 0)
                throw new UserFacingError("一か八かの技はまだ使えません。");
            if (fighter.silencedRounds > 0)
                throw new UserFacingError("封印されていて使えません。");
        }
        if (action.type === "item") {
            if (!action.itemKey || !game_core_1.ITEMS[action.itemKey])
                throw new UserFacingError("アイテムが不正です。");
            const inv = await prisma_1.prisma.inventoryItem.findUnique({
                where: { userId_itemKey: { userId, itemKey: action.itemKey } },
            });
            if (!inv || inv.quantity <= 0)
                throw new UserFacingError("そのアイテムを持っていません。");
            await prisma_1.prisma.inventoryItem.update({
                where: { userId_itemKey: { userId, itemKey: action.itemKey } },
                data: { quantity: { decrement: 1 } },
            });
        }
        if (room.phase !== "round" || room.pending[userId])
            return;
        room.pending[userId] = action;
        this.maybeResolveRound(room);
    }
    maybeResolveRound(room) {
        const actionable = (0, engine_1.actionableParticipantIds)(room);
        const allSubmitted = actionable.length > 0 && actionable.every((pid) => !!room.pending[pid]);
        if (allSubmitted) {
            if (room.roundTimer) {
                clearTimeout(room.roundTimer);
                room.roundTimer = null;
            }
            this.resolveRoundNow(room);
        }
        else {
            this.broadcastState(room);
        }
    }
    handleRoundTimeout(roomId, roundNo) {
        const room = this.rooms.get(roomId);
        if (!room || room.phase !== "round" || room.roundNo !== roundNo || room.resolving)
            return;
        const actionable = (0, engine_1.actionableParticipantIds)(room);
        if (actionable.every((pid) => !!room.pending[pid]))
            return;
        room.log.push(`⌛ ${game_core_1.RAID_ROUND_ACTION_TIMEOUT_MS / 1000}秒経過。未選択の挑戦者は自動的に「こうげき」を行います。`);
        this.resolveRoundNow(room);
    }
    resolveRoundNow(room) {
        if (room.resolving)
            return;
        room.resolving = true;
        const weakPointActive = room.phase === "round" && room.roundNo % game_core_1.WEAKPOINT_EVERY === 0;
        let bossDefeated = false;
        let steps = [];
        try {
            const result = (0, engine_1.resolveParticipantActions)(room, weakPointActive);
            bossDefeated = result.bossDefeated;
            steps = result.steps;
            if (!bossDefeated) {
                steps = [...steps, ...(0, engine_1.bossTurn)(room)];
            }
        }
        finally {
            room.resolving = false;
        }
        room.lastRoundSteps = steps;
        if (bossDefeated || room.boss.hp <= 0) {
            this.finish(room, true).catch((err) => console.error("[raid finish]", err));
            return;
        }
        const alive = (0, engine_1.aliveParticipantIds)(room);
        if (alive.length === 0) {
            this.finish(room, false, "全滅").catch((err) => console.error("[raid finish]", err));
            return;
        }
        // ラウンド結果(参加者の行動+ボスの行動)をすぐに反映して見せてから、クライアントが
        // 1手ずつ(約2秒間隔で)再生し終える時間だけ待って次のラウンドへ進める
        this.broadcastState(room);
        const delay = Math.max(game_core_1.RAID_ROUND_INTERMISSION_MS, steps.length * game_core_1.STEP_REPLAY_MS + game_core_1.STEP_REPLAY_BUFFER_MS);
        setTimeout(() => {
            if (room.phase === "round")
                this.beginRound(room);
        }, delay);
    }
    async leaveRaid(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        if (!room.participantIds.includes(userId))
            return;
        if (room.phase === "lobby") {
            if (room.hostUserId === userId) {
                room.participantIds.forEach((pid) => this.userRoom.delete(pid));
                this.rooms.delete(room.id);
                room.log.push("主催者が退出したため、レイドは中止されました。");
                room.phase = "finished";
                this.broadcastState(room);
                this.broadcastLobbies();
                return;
            }
            room.participantIds = room.participantIds.filter((id) => id !== userId);
            delete room.participantNames[userId];
            this.userRoom.delete(userId);
            this.broadcastState(room);
            this.broadcastLobbies();
            return;
        }
        if (room.phase === "finished")
            return;
        this.userRoom.delete(userId);
        if (room.phase === "select") {
            room.participantIds = room.participantIds.filter((id) => id !== userId);
            delete room.participantNames[userId];
            if (room.participantIds.length === 0) {
                await this.finish(room, false, "参加者全員が離脱");
                return;
            }
            const allSelected = room.participantIds.every((pid) => !!room.fighters[pid]);
            if (allSelected) {
                if (room.selectTimer) {
                    clearTimeout(room.selectTimer);
                    room.selectTimer = null;
                }
                room.phase = "round";
                this.beginRound(room);
            }
            else {
                this.broadcastState(room);
            }
            return;
        }
        // round フェーズ: 離脱 = 戦闘不能扱い
        const fighter = room.fighters[userId];
        if (fighter && fighter.hp > 0) {
            fighter.hp = 0;
            fighter.retired = true;
            room.log.push(`🏳️ ${fighter.displayName} がレイドを離脱しました。`);
        }
        const alive = (0, engine_1.aliveParticipantIds)(room);
        if (alive.length === 0) {
            await this.finish(room, false, "全滅");
            return;
        }
        this.maybeResolveRound(room);
    }
    handleDisconnect(userId) {
        const roomId = this.userRoom.get(userId);
        if (!roomId)
            return;
        setTimeout(() => {
            if ((0, presence_1.isUserOnline)(userId))
                return;
            if (this.userRoom.get(userId) !== roomId)
                return;
            this.leaveRaid(roomId, userId).catch((err) => console.error("[raid disconnect leave]", err));
        }, 20_000);
    }
    handleSelectTimeout(roomId) {
        const room = this.rooms.get(roomId);
        if (!room || room.phase !== "select")
            return;
        const allSelected = room.participantIds.every((pid) => !!room.fighters[pid]);
        if (allSelected)
            return;
        room.participantIds.forEach((pid) => this.userRoom.delete(pid));
        room.phase = "finished";
        room.winner = false;
        room.finishReason = "キャラクター選択タイムアウト";
        room.log.push("⌛ キャラクター選択がタイムアウトしたため、レイドは中止されました。");
        this.broadcastState(room);
        this.cleanupRoom(room);
    }
    async finish(room, victory, reason) {
        room.phase = "finished";
        room.winner = victory;
        room.finishReason = reason ?? null;
        if (room.selectTimer)
            clearTimeout(room.selectTimer);
        if (room.roundTimer)
            clearTimeout(room.roundTimer);
        if (victory) {
            room.log.push(`🏆 討伐成功! ${room.boss?.name ?? ""} を倒した!`);
        }
        else {
            room.log.push(`💀 討伐失敗…(${reason ?? ""}) ${room.boss?.name ?? ""} を倒しきれなかった。`);
        }
        let mvpId = null;
        if (victory) {
            let topDmg = 0;
            for (const pid of room.participantIds) {
                const dmg = room.damageDealt[pid] ?? 0;
                if (dmg > topDmg) {
                    topDmg = dmg;
                    mvpId = pid;
                }
            }
        }
        room.mvpUserId = mvpId;
        const updates = [];
        for (const pid of room.participantIds) {
            let amount = victory ? game_core_1.RAID_WIN_REWARD : game_core_1.RAID_LOSE_REWARD;
            if (victory && pid === mvpId)
                amount += game_core_1.RAID_MVP_BONUS;
            room.rewards[pid] = amount;
            updates.push(prisma_1.prisma.user.update({ where: { id: pid }, data: { money: { increment: amount } } }));
            if (victory && Math.floor(Math.random() * 100) + 1 <= game_core_1.RAID_ITEM_DROP_CHANCE) {
                const itemKey = (0, game_core_1.chooseBossDropItem)();
                const item = game_core_1.ITEMS[itemKey];
                room.drops[pid] = { itemKey, name: item.name, emoji: item.emoji };
                updates.push(prisma_1.prisma.inventoryItem.upsert({
                    where: { userId_itemKey: { userId: pid, itemKey } },
                    create: { userId: pid, itemKey, quantity: 1 },
                    update: { quantity: { increment: 1 } },
                }));
            }
        }
        await Promise.all(updates);
        room.participantIds.forEach((pid) => this.userRoom.delete(pid));
        this.broadcastState(room);
        this.broadcastLobbies();
        this.cleanupRoom(room);
    }
    cleanupRoom(room) {
        setTimeout(() => this.rooms.delete(room.id), 5 * 60 * 1000);
    }
    requireParticipant(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (!room)
            throw new UserFacingError("レイドが見つかりません。");
        if (!room.participantIds.includes(userId))
            throw new UserFacingError("このレイドの参加者ではありません。");
        return room;
    }
    sendState(room, userId) {
        this.io.to(`user:${userId}`).emit("raid:state", (0, dto_1.roomToStateDTO)(room));
    }
    broadcastState(room) {
        const dto = (0, dto_1.roomToStateDTO)(room);
        for (const pid of room.participantIds) {
            this.io.to(`user:${pid}`).emit("raid:state", dto);
        }
    }
}
exports.RaidManager = RaidManager;
