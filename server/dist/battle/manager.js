"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BattleManager = exports.UserFacingError = void 0;
const crypto_1 = require("crypto");
const game_core_1 = require("@identity-slot/game-core");
const prisma_1 = require("../lib/prisma");
const presence_1 = require("../socket/presence");
const dto_1 = require("./dto");
const engine_1 = require("./engine");
class UserFacingError extends Error {
}
exports.UserFacingError = UserFacingError;
class BattleManager {
    io;
    challenges = new Map();
    rooms = new Map();
    roomByUser = new Map();
    constructor(io) {
        this.io = io;
    }
    async createChallenge(fromUserId, toUserId) {
        if (fromUserId === toUserId)
            throw new UserFacingError("自分には挑戦できません。");
        if (this.roomByUser.has(fromUserId))
            throw new UserFacingError("あなたはすでに別のバトル中です。");
        if (this.roomByUser.has(toUserId))
            throw new UserFacingError("相手は別のバトル中です。");
        if (!(0, presence_1.isUserOnline)(toUserId))
            throw new UserFacingError("相手はオフラインです。");
        const [fromUser, toUser, fromCharCount] = await Promise.all([
            prisma_1.prisma.user.findUnique({ where: { id: fromUserId } }),
            prisma_1.prisma.user.findUnique({ where: { id: toUserId } }),
            prisma_1.prisma.character.count({ where: { userId: fromUserId } }),
        ]);
        if (!fromUser || !toUser)
            throw new UserFacingError("ユーザーが見つかりません。");
        if (fromCharCount === 0)
            throw new UserFacingError("あなたはまだキャラクターがいません。先にガチャを引いてください。");
        const id = (0, crypto_1.randomUUID)();
        const timer = setTimeout(() => this.expireChallenge(id), game_core_1.CHALLENGE_TIMEOUT_MS);
        const challenge = {
            id,
            fromUserId,
            fromDisplayName: fromUser.displayName,
            toUserId,
            toDisplayName: toUser.displayName,
            expiresAt: Date.now() + game_core_1.CHALLENGE_TIMEOUT_MS,
            timer,
        };
        this.challenges.set(id, challenge);
        this.emitToUser(toUserId, "battle:challengeReceived", {
            challengeId: id,
            from: { id: fromUserId, displayName: fromUser.displayName },
            expiresAt: challenge.expiresAt,
        });
        return { challengeId: id };
    }
    expireChallenge(challengeId) {
        const c = this.challenges.get(challengeId);
        if (!c)
            return;
        this.challenges.delete(challengeId);
        this.emitToUser(c.fromUserId, "battle:challengeUpdate", { challengeId, status: "expired" });
        this.emitToUser(c.toUserId, "battle:challengeUpdate", { challengeId, status: "expired" });
    }
    async respondChallenge(challengeId, byUserId, accept) {
        const c = this.challenges.get(challengeId);
        if (!c)
            throw new UserFacingError("この挑戦は既に無効です。");
        if (c.toUserId !== byUserId)
            throw new UserFacingError("この挑戦に応答する権限がありません。");
        clearTimeout(c.timer);
        this.challenges.delete(challengeId);
        if (!accept) {
            this.emitToUser(c.fromUserId, "battle:challengeUpdate", { challengeId, status: "declined" });
            return { accepted: false };
        }
        if (this.roomByUser.has(c.fromUserId) || this.roomByUser.has(c.toUserId)) {
            this.emitToUser(c.fromUserId, "battle:challengeUpdate", {
                challengeId,
                status: "error",
                message: "相手はすでに別のバトル中です。",
            });
            throw new UserFacingError("すでに別のバトル中です。");
        }
        const room = this.createRoom(c.fromUserId, c.toUserId);
        this.emitToUser(c.fromUserId, "battle:roomReady", {
            roomId: room.id,
            opponent: { id: c.toUserId, displayName: c.toDisplayName },
        });
        this.emitToUser(c.toUserId, "battle:roomReady", {
            roomId: room.id,
            opponent: { id: c.fromUserId, displayName: c.fromDisplayName },
        });
        return { accepted: true, roomId: room.id };
    }
    createRoom(userA, userB) {
        const room = {
            id: (0, crypto_1.randomUUID)(),
            createdAt: Date.now(),
            userIds: [userA, userB],
            fighters: {},
            phase: "select",
            roundNo: 0,
            pending: {},
            log: [],
            lastRoundSteps: [],
            winnerUserId: null,
            rewards: {},
            roundTimer: null,
            selectTimer: null,
            resolving: false,
        };
        this.rooms.set(room.id, room);
        this.roomByUser.set(userA, room.id);
        this.roomByUser.set(userB, room.id);
        room.selectTimer = setTimeout(() => this.handleSelectTimeout(room.id), game_core_1.CHARACTER_SELECT_TIMEOUT_MS);
        return room;
    }
    getRoomForUser(userId) {
        const roomId = this.roomByUser.get(userId);
        return roomId ? this.rooms.get(roomId) : undefined;
    }
    joinRoom(roomId, userId) {
        const room = this.requireRoomMember(roomId, userId);
        this.broadcastState(room);
    }
    async selectCharacter(roomId, userId, characterId) {
        const room = this.requireRoomMember(roomId, userId);
        if (room.phase !== "select")
            throw new UserFacingError("すでにキャラクターが選択されています。");
        if (room.fighters[userId])
            throw new UserFacingError("すでに選択済みです。");
        const [character, user] = await Promise.all([
            prisma_1.prisma.character.findFirst({ where: { id: characterId, userId } }),
            prisma_1.prisma.user.findUnique({ where: { id: userId } }),
        ]);
        if (!character)
            throw new UserFacingError("キャラクターが見つかりません。");
        if (!user)
            throw new UserFacingError("ユーザーが見つかりません。");
        room.fighters[userId] = (0, engine_1.buildFighter)(character, userId, user.displayName);
        const [p1, p2] = room.userIds;
        if (room.fighters[p1] && room.fighters[p2]) {
            if (room.selectTimer) {
                clearTimeout(room.selectTimer);
                room.selectTimer = null;
            }
            room.phase = "round";
            this.startRound(room);
        }
        else {
            this.broadcastState(room);
        }
    }
    startRound(room) {
        room.roundNo += 1;
        room.pending = {};
        if (room.roundNo > game_core_1.MAX_BATTLE_ROUNDS) {
            this.finishByHp(room);
            return;
        }
        room.roundTimer = setTimeout(() => this.handleRoundTimeout(room.id, room.roundNo), game_core_1.ROUND_ACTION_TIMEOUT_MS);
        this.broadcastState(room);
    }
    async submitAction(roomId, userId, action) {
        const room = this.requireRoomMember(roomId, userId);
        if (room.phase !== "round")
            throw new UserFacingError("現在は行動を選択できません。");
        if (room.pending[userId])
            throw new UserFacingError("すでに行動を選択済みです。");
        const fighter = room.fighters[userId];
        const opponentId = room.userIds.find((id) => id !== userId);
        if (action.type === "special") {
            if (!fighter.hasSpecial || fighter.specialCooldown > 0)
                throw new UserFacingError("とくぎはまだ使えません。");
        }
        if (action.type === "gamble") {
            if (!fighter.hasGamble || fighter.gambleCooldown > 0) {
                throw new UserFacingError("一か八かの技はまだ使えません。");
            }
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
        // 直前の非同期処理(アイテムDB更新)中にラウンドが別要因で進行/終了していないか確認
        if (room.phase !== "round" || room.pending[userId])
            return;
        room.pending[userId] = action;
        if (room.pending[userId] && room.pending[opponentId]) {
            if (room.roundTimer) {
                clearTimeout(room.roundTimer);
                room.roundTimer = null;
            }
            this.resolveAndContinue(room);
        }
        else {
            this.broadcastState(room);
        }
    }
    handleRoundTimeout(roomId, roundNo) {
        const room = this.rooms.get(roomId);
        if (!room || room.phase !== "round" || room.roundNo !== roundNo || room.resolving)
            return;
        const [p1, p2] = room.userIds;
        if (room.pending[p1] && room.pending[p2])
            return;
        room.log.push(`⌛ ${game_core_1.ROUND_ACTION_TIMEOUT_MS / 1000}秒経過。未選択のプレイヤーは自動的に「こうげき」を行います。`);
        this.resolveAndContinue(room);
    }
    resolveAndContinue(room) {
        if (room.resolving)
            return;
        room.resolving = true;
        let steps = [];
        try {
            steps = (0, engine_1.resolveRound)(room);
        }
        finally {
            room.resolving = false;
        }
        room.lastRoundSteps = steps;
        const [p1, p2] = room.userIds;
        const f1 = room.fighters[p1];
        const f2 = room.fighters[p2];
        const f1Down = f1.hp <= 0;
        const f2Down = f2.hp <= 0;
        if (f1Down || f2Down) {
            let winner = "draw";
            if (f1Down && !f2Down)
                winner = p2;
            else if (f2Down && !f1Down)
                winner = p1;
            this.finish(room, winner).catch((err) => console.error("[battle finish]", err));
            return;
        }
        // ラウンド結果をすぐに反映して見せてから、クライアントが行動ステップを1手ずつ(約2秒間隔で)
        // 再生し終える時間だけ待ってから次のラウンドへ進める(連打で瞬時に決着してしまうのを防ぐ)
        this.broadcastState(room);
        const delay = Math.max(game_core_1.ROUND_INTERMISSION_MS, steps.length * game_core_1.STEP_REPLAY_MS + game_core_1.STEP_REPLAY_BUFFER_MS);
        setTimeout(() => {
            if (room.phase === "round")
                this.startRound(room);
        }, delay);
    }
    finishByHp(room) {
        const [p1, p2] = room.userIds;
        const f1 = room.fighters[p1];
        const f2 = room.fighters[p2];
        let winner = "draw";
        if (f1.hp > f2.hp)
            winner = p1;
        else if (f2.hp > f1.hp)
            winner = p2;
        this.finish(room, winner).catch((err) => console.error("[battle finish]", err));
    }
    async retire(roomId, userId) {
        const room = this.requireRoomMember(roomId, userId);
        if (room.phase === "finished")
            return;
        if (room.phase === "select") {
            this.cancelRoom(room, `🏳️ ${this.displayNameOf(room, userId)} が退出したため、バトルは中止されました。`);
            return;
        }
        if (room.roundTimer) {
            clearTimeout(room.roundTimer);
            room.roundTimer = null;
        }
        const fighter = room.fighters[userId];
        fighter.hp = 0;
        fighter.retired = true;
        room.log.push(`🏳️ ${fighter.displayName} がリタイアしました。`);
        const opponentId = room.userIds.find((id) => id !== userId);
        await this.finish(room, opponentId);
    }
    cancelRoom(room, message) {
        room.phase = "finished";
        room.winnerUserId = null;
        room.log.push(message);
        if (room.selectTimer)
            clearTimeout(room.selectTimer);
        if (room.roundTimer)
            clearTimeout(room.roundTimer);
        this.broadcastState(room);
        this.cleanupRoom(room);
    }
    handleSelectTimeout(roomId) {
        const room = this.rooms.get(roomId);
        if (!room || room.phase !== "select")
            return;
        this.cancelRoom(room, "⌛ キャラクター選択がタイムアウトしたため、バトルは中止されました。");
    }
    async finish(room, winner) {
        room.phase = "finished";
        room.winnerUserId = winner;
        const [p1, p2] = room.userIds;
        if (winner === "draw") {
            room.rewards[p1] = game_core_1.BATTLE_DRAW_REWARD;
            room.rewards[p2] = game_core_1.BATTLE_DRAW_REWARD;
            room.log.push("💥 DRAW! 決着つかず。");
        }
        else {
            const loser = winner === p1 ? p2 : p1;
            room.rewards[winner] = game_core_1.BATTLE_WIN_REWARD;
            room.rewards[loser] = game_core_1.BATTLE_LOSE_REWARD;
            room.log.push(`🏆 ${room.fighters[winner]?.displayName ?? "勝者"} の勝利!`);
        }
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.user.update({ where: { id: p1 }, data: { money: { increment: room.rewards[p1] ?? 0 } } }),
            prisma_1.prisma.user.update({ where: { id: p2 }, data: { money: { increment: room.rewards[p2] ?? 0 } } }),
        ]);
        this.broadcastState(room);
        this.cleanupRoom(room);
    }
    cleanupRoom(room) {
        for (const uid of room.userIds) {
            if (this.roomByUser.get(uid) === room.id)
                this.roomByUser.delete(uid);
        }
        setTimeout(() => this.rooms.delete(room.id), 5 * 60 * 1000);
    }
    handleDisconnect(userId) {
        const room = this.getRoomForUser(userId);
        if (!room || room.phase === "finished")
            return;
        setTimeout(() => {
            if ((0, presence_1.isUserOnline)(userId))
                return;
            const stillRoom = this.getRoomForUser(userId);
            if (!stillRoom || stillRoom.id !== room.id || stillRoom.phase === "finished")
                return;
            this.retire(room.id, userId).catch((err) => console.error("[battle disconnect retire]", err));
        }, 20_000);
    }
    requireRoomMember(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (!room)
            throw new UserFacingError("バトルが見つかりません。");
        if (!room.userIds.includes(userId))
            throw new UserFacingError("このバトルの参加者ではありません。");
        return room;
    }
    displayNameOf(room, userId) {
        return room.fighters[userId]?.displayName ?? "プレイヤー";
    }
    broadcastState(room) {
        const dto = (0, dto_1.roomToStateDTO)(room);
        for (const uid of room.userIds) {
            this.emitToUser(uid, "battle:state", dto);
        }
    }
    emitToUser(userId, event, payload) {
        this.io.to(`user:${userId}`).emit(event, payload);
    }
}
exports.BattleManager = BattleManager;
