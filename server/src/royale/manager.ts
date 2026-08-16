import { randomUUID } from "crypto";
import { Server as IOServer } from "socket.io";
import {
  MAX_ROYALE_PARTICIPANTS,
  MIN_ROYALE_PARTICIPANTS,
  ROYALE_CHARACTER_SELECT_TIMEOUT_MS,
  ROYALE_LOSE_REWARD,
  ROYALE_ROUND_ACTION_TIMEOUT_MS,
  ROYALE_ROUND_INTERMISSION_MS,
  ROYALE_WIN_REWARD,
  STEP_REPLAY_BUFFER_MS,
  STEP_REPLAY_MS,
} from "@identity-slot/game-core";
import { prisma } from "../lib/prisma";
import { sendPushToUser, sendPushToUsers } from "../lib/push";
import { isUserOnline } from "../socket/presence";
import { ITEMS } from "@identity-slot/game-core";
import { roomToLobbySummary, roomToStateDTO } from "./dto";
import { aliveParticipantIds, buildRoyaleFighter, resolveRoyaleRound } from "./engine";
import { RoyalePendingAction, RoyaleRoom, RoyaleRoundStep } from "./types";

export class UserFacingError extends Error {}

export class RoyaleManager {
  private io: IOServer;
  private rooms = new Map<string, RoyaleRoom>();
  private userRoom = new Map<string, string>();

  constructor(io: IOServer) {
    this.io = io;
  }

  private createRoomShell(roomName: string, hostUserId: string, hostDisplayName: string): RoyaleRoom {
    return {
      id: randomUUID(),
      roomName,
      hostUserId,
      phase: "lobby",
      participantIds: [hostUserId],
      participantNames: { [hostUserId]: hostDisplayName },
      fighters: {},
      roundNo: 0,
      pending: {},
      log: [],
      lastRoundSteps: [],
      eliminationOrder: [],
      winnerUserId: null,
      finishReason: null,
      rewards: {},
      createdAt: Date.now(),
      selectTimer: null,
      roundTimer: null,
      resolving: false,
      chatLog: [],
      spectatorIds: new Set(),
      spectatorNames: {},
    };
  }

  async createLobby(hostUserId: string, roomName: string) {
    const trimmed = roomName.trim();
    if (!trimmed) throw new UserFacingError("部屋の名前を入力してください。");
    if (trimmed.length > 30) throw new UserFacingError("部屋の名前は30文字以内にしてください。");
    if (this.userRoom.has(hostUserId)) throw new UserFacingError("すでに別のバトルロイヤルに参加中です。");

    const user = await prisma.user.findUnique({ where: { id: hostUserId } });
    if (!user) throw new UserFacingError("ユーザーが見つかりません。");

    const room = this.createRoomShell(trimmed, hostUserId, user.displayName);
    this.rooms.set(room.id, room);
    this.userRoom.set(hostUserId, room.id);
    this.broadcastLobbies();
    return { roomId: room.id };
  }

  listLobbies() {
    return [...this.rooms.values()].filter((r) => r.phase === "lobby").map(roomToLobbySummary);
  }

  private broadcastLobbies() {
    this.io.emit("royale:lobbiesUpdated", { lobbies: this.listLobbies() });
  }

  listActiveRoyales() {
    return [...this.rooms.values()]
      .filter((r) => r.phase === "select" || r.phase === "round")
      .map((r) => ({
        roomId: r.id,
        roomName: r.roomName,
        phase: r.phase,
        roundNo: r.roundNo,
        participantCount: r.participantIds.length,
        spectatorCount: r.spectatorIds.size,
      }));
  }

  private broadcastActiveList() {
    this.io.emit("royale:activeUpdated", { royales: this.listActiveRoyales() });
  }

  async spectate(roomId: string, userId: string) {
    const room = this.rooms.get(roomId);
    if (!room) throw new UserFacingError("バトルロイヤルが見つかりません。");
    if (room.participantIds.includes(userId)) throw new UserFacingError("参加者は観戦できません。");
    room.spectatorIds.add(userId);
    if (!room.spectatorNames[userId]) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      room.spectatorNames[userId] = user?.displayName ?? "観戦者";
    }
    this.sendState(room, userId);
    this.broadcastActiveList();
  }

  unspectate(roomId: string, userId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.spectatorIds.delete(userId);
    this.broadcastActiveList();
  }

  async joinLobby(roomId: string, userId: string) {
    const room = this.rooms.get(roomId);
    if (!room) throw new UserFacingError("バトルロイヤルが見つかりません。");
    if (room.phase !== "lobby") throw new UserFacingError("すでに開始されたバトルロイヤルです。");
    if (room.participantIds.includes(userId)) return { roomId: room.id };
    if (room.participantIds.length >= MAX_ROYALE_PARTICIPANTS) throw new UserFacingError("満員です。");
    if (this.userRoom.has(userId)) throw new UserFacingError("すでに別のバトルロイヤルに参加中です。");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UserFacingError("ユーザーが見つかりません。");

    room.participantIds.push(userId);
    room.participantNames[userId] = user.displayName;
    this.userRoom.set(userId, room.id);

    this.broadcastState(room);
    this.broadcastLobbies();

    sendPushToUser(room.hostUserId, {
      title: "🌀 バトルロイヤルに参加者が来ました",
      body: `${user.displayName} が「${room.roomName}」に参加しました。`,
      url: `/battle/royale/${room.id}`,
      tag: "royale-join",
    }).catch((err) => console.error("[push] royale join notify failed", err));

    return { roomId: room.id };
  }

  joinRoom(roomId: string, userId: string) {
    const room = this.rooms.get(roomId);
    if (!room) throw new UserFacingError("バトルロイヤルが見つかりません。");
    if (!room.participantIds.includes(userId)) throw new UserFacingError("このバトルロイヤルの参加者ではありません。");
    this.sendState(room, userId);
  }

  getActiveRoomId(userId: string): string | null {
    return this.userRoom.get(userId) ?? null;
  }

  async startRoyale(roomId: string, byUserId: string) {
    const room = this.rooms.get(roomId);
    if (!room) throw new UserFacingError("バトルロイヤルが見つかりません。");
    if (room.hostUserId !== byUserId) throw new UserFacingError("主催者のみが開始できます。");
    if (room.phase !== "lobby") throw new UserFacingError("すでに開始されています。");
    if (room.participantIds.length < MIN_ROYALE_PARTICIPANTS) {
      throw new UserFacingError(`開始には${MIN_ROYALE_PARTICIPANTS}人以上必要です。`);
    }

    room.phase = "select";
    room.selectTimer = setTimeout(() => this.handleSelectTimeout(room.id), ROYALE_CHARACTER_SELECT_TIMEOUT_MS);

    this.broadcastState(room);
    this.broadcastLobbies();
    this.broadcastActiveList();
  }

  async selectCharacter(roomId: string, userId: string, characterId: string) {
    const room = this.requireParticipant(roomId, userId);
    if (room.phase !== "select") throw new UserFacingError("現在はキャラクターを選択できません。");
    if (room.fighters[userId]) throw new UserFacingError("すでに選択済みです。");

    const character = await prisma.character.findFirst({ where: { id: characterId, userId, soldAt: null } });
    if (!character) throw new UserFacingError("キャラクターが見つかりません。");

    room.fighters[userId] = buildRoyaleFighter(character, userId, room.participantNames[userId] ?? "プレイヤー");

    const allSelected = room.participantIds.every((pid) => !!room.fighters[pid]);
    if (allSelected) {
      if (room.selectTimer) {
        clearTimeout(room.selectTimer);
        room.selectTimer = null;
      }
      room.phase = "round";
      this.beginRound(room);
    } else {
      this.broadcastState(room);
    }
  }

  private beginRound(room: RoyaleRoom) {
    room.roundNo += 1;
    room.pending = {};

    const alive = aliveParticipantIds(room);
    if (alive.length <= 1) {
      this.finish(room, alive[0] ?? null).catch((err) => console.error("[royale finish]", err));
      return;
    }

    room.roundTimer = setTimeout(() => this.handleRoundTimeout(room.id, room.roundNo), ROYALE_ROUND_ACTION_TIMEOUT_MS);
    this.broadcastState(room);

    if (room.roundNo > 1) {
      sendPushToUsers(alive, {
        title: "🌀 あなたの番です",
        body: `「${room.roomName}」で行動を選択してください。`,
        url: `/battle/royale/${room.id}`,
        tag: "royale-turn",
      }).catch((err) => console.error("[push] royale turn notify failed", err));
    }
  }

  async submitAction(roomId: string, userId: string, action: RoyalePendingAction) {
    const room = this.requireParticipant(roomId, userId);
    if (room.phase !== "round") throw new UserFacingError("現在は行動を選択できません。");
    if (room.pending[userId]) throw new UserFacingError("すでに行動を選択済みです。");

    const fighter = room.fighters[userId];
    if (!fighter || fighter.hp <= 0) throw new UserFacingError("行動できません。");

    if (action.targetId && !aliveParticipantIds(room).includes(action.targetId)) {
      throw new UserFacingError("対象が不正です。");
    }
    if (action.targetId === userId) throw new UserFacingError("自分を対象にはできません。");

    if (action.type === "special") {
      if (!fighter.hasSpecial || fighter.specialCooldown > 0) throw new UserFacingError("とくぎはまだ使えません。");
    }
    if (action.type === "gamble") {
      if (!fighter.hasGamble || fighter.gambleCooldown > 0) throw new UserFacingError("一か八かの技はまだ使えません。");
    }
    if (action.type === "item") {
      if (!action.itemKey || !ITEMS[action.itemKey]) throw new UserFacingError("アイテムが不正です。");
      const inv = await prisma.inventoryItem.findUnique({
        where: { userId_itemKey: { userId, itemKey: action.itemKey } },
      });
      if (!inv || inv.quantity <= 0) throw new UserFacingError("そのアイテムを持っていません。");
      await prisma.inventoryItem.update({
        where: { userId_itemKey: { userId, itemKey: action.itemKey } },
        data: { quantity: { decrement: 1 } },
      });
    }

    if (room.phase !== "round" || room.pending[userId]) return;
    room.pending[userId] = action;

    this.maybeResolveRound(room);
  }

  sendChatMessage(roomId: string, userId: string, text: string) {
    const room = this.rooms.get(roomId);
    if (!room) throw new UserFacingError("バトルロイヤルが見つかりません。");
    const isMember = room.participantIds.includes(userId) || room.spectatorIds.has(userId);
    if (!isMember) throw new UserFacingError("このバトルロイヤルの参加者・観戦者ではありません。");

    const trimmed = text.trim();
    if (!trimmed) throw new UserFacingError("メッセージを入力してください。");
    if (trimmed.length > 200) throw new UserFacingError("メッセージは200文字以内にしてください。");

    const displayName = room.participantNames[userId] ?? room.spectatorNames[userId] ?? "観戦者";
    const message = { userId, displayName, text: trimmed, at: Date.now() };
    room.chatLog.push(message);
    if (room.chatLog.length > 50) room.chatLog.shift();

    for (const pid of [...room.participantIds, ...room.spectatorIds]) {
      this.io.to(`user:${pid}`).emit("royale:chat", message);
    }
  }

  private maybeResolveRound(room: RoyaleRoom) {
    const alive = aliveParticipantIds(room);
    const allSubmitted = alive.length > 0 && alive.every((pid) => !!room.pending[pid]);
    if (allSubmitted) {
      if (room.roundTimer) {
        clearTimeout(room.roundTimer);
        room.roundTimer = null;
      }
      this.resolveRoundNow(room);
    } else {
      this.broadcastState(room);
    }
  }

  private handleRoundTimeout(roomId: string, roundNo: number) {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== "round" || room.roundNo !== roundNo || room.resolving) return;
    const alive = aliveParticipantIds(room);
    if (alive.every((pid) => !!room.pending[pid])) return;
    room.log.push(`⌛ ${ROYALE_ROUND_ACTION_TIMEOUT_MS / 1000}秒経過。未選択の参加者は自動的に「こうげき」を行います。`);
    this.resolveRoundNow(room);
  }

  private resolveRoundNow(room: RoyaleRoom) {
    if (room.resolving) return;
    room.resolving = true;
    let steps: RoyaleRoundStep[] = [];
    let decided = false;
    try {
      const result = resolveRoyaleRound(room);
      steps = result.steps;
      decided = result.decided;
    } finally {
      room.resolving = false;
    }
    room.lastRoundSteps = steps;

    const alive = aliveParticipantIds(room);
    if (decided || alive.length <= 1) {
      this.broadcastState(room);
      const delay = Math.max(ROYALE_ROUND_INTERMISSION_MS, steps.length * STEP_REPLAY_MS + STEP_REPLAY_BUFFER_MS);
      setTimeout(() => {
        this.finish(room, alive[0] ?? null).catch((err) => console.error("[royale finish]", err));
      }, delay);
      return;
    }

    this.broadcastState(room);
    const delay = Math.max(ROYALE_ROUND_INTERMISSION_MS, steps.length * STEP_REPLAY_MS + STEP_REPLAY_BUFFER_MS);
    setTimeout(() => {
      if (room.phase === "round") this.beginRound(room);
    }, delay);
  }

  async leaveRoyale(roomId: string, userId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (!room.participantIds.includes(userId)) return;

    if (room.phase === "lobby") {
      if (room.hostUserId === userId) {
        room.participantIds.forEach((pid) => this.userRoom.delete(pid));
        this.rooms.delete(room.id);
        room.log.push("主催者が退出したため、バトルロイヤルは中止されました。");
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

    if (room.phase === "finished") return;

    this.userRoom.delete(userId);

    if (room.phase === "select") {
      room.participantIds = room.participantIds.filter((id) => id !== userId);
      delete room.participantNames[userId];
      if (room.participantIds.length === 0) {
        await this.finish(room, null, "参加者全員が離脱");
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
      } else {
        this.broadcastState(room);
      }
      return;
    }

    // round フェーズ: 離脱 = 脱落扱い
    const fighter = room.fighters[userId];
    if (fighter && fighter.hp > 0) {
      fighter.hp = 0;
      fighter.retired = true;
      room.eliminationOrder.push(userId);
      room.log.push(`🏳️ ${fighter.displayName} がバトルロイヤルを離脱しました。`);
    }

    const alive = aliveParticipantIds(room);
    if (alive.length <= 1) {
      await this.finish(room, alive[0] ?? null);
      return;
    }

    this.maybeResolveRound(room);
  }

  handleDisconnect(userId: string) {
    const roomId = this.userRoom.get(userId);
    if (!roomId) return;
    setTimeout(() => {
      if (isUserOnline(userId)) return;
      if (this.userRoom.get(userId) !== roomId) return;
      this.leaveRoyale(roomId, userId).catch((err) => console.error("[royale disconnect leave]", err));
    }, 60_000);
  }

  private handleSelectTimeout(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== "select") return;
    const allSelected = room.participantIds.every((pid) => !!room.fighters[pid]);
    if (allSelected) return;
    room.participantIds.forEach((pid) => this.userRoom.delete(pid));
    room.phase = "finished";
    room.finishReason = "キャラクター選択タイムアウト";
    room.log.push("⌛ キャラクター選択がタイムアウトしたため、バトルロイヤルは中止されました。");
    this.broadcastState(room);
    this.cleanupRoom(room);
  }

  private async finish(room: RoyaleRoom, winnerId: string | null, reason?: string) {
    room.phase = "finished";
    room.winnerUserId = winnerId;
    room.finishReason = reason ?? null;
    if (room.selectTimer) clearTimeout(room.selectTimer);
    if (room.roundTimer) clearTimeout(room.roundTimer);

    if (winnerId) {
      room.log.push(`🏆 ${room.participantNames[winnerId] ?? "優勝者"} の勝利! 最後の1人になった!`);
    } else {
      room.log.push(`💥 決着つかず…(${reason ?? "参加者不足"})`);
    }

    const updates: Promise<unknown>[] = [];
    for (const pid of room.participantIds) {
      const amount = pid === winnerId ? ROYALE_WIN_REWARD : ROYALE_LOSE_REWARD;
      room.rewards[pid] = amount;
      updates.push(prisma.user.update({ where: { id: pid }, data: { money: { increment: amount } } }));
    }
    await Promise.all(updates);

    if (winnerId) {
      await prisma.user.update({ where: { id: winnerId }, data: { royaleWins: { increment: 1 } } }).catch((err) =>
        console.error("[royale] royaleWins increment failed", err)
      );
    }

    room.participantIds.forEach((pid) => this.userRoom.delete(pid));
    this.broadcastState(room);
    this.broadcastLobbies();
    this.cleanupRoom(room);
  }

  private cleanupRoom(room: RoyaleRoom) {
    this.broadcastActiveList();
    setTimeout(() => this.rooms.delete(room.id), 5 * 60 * 1000);
  }

  private requireParticipant(roomId: string, userId: string): RoyaleRoom {
    const room = this.rooms.get(roomId);
    if (!room) throw new UserFacingError("バトルロイヤルが見つかりません。");
    if (!room.participantIds.includes(userId)) throw new UserFacingError("このバトルロイヤルの参加者ではありません。");
    return room;
  }

  private sendState(room: RoyaleRoom, userId: string) {
    this.io.to(`user:${userId}`).emit("royale:state", roomToStateDTO(room));
  }

  private broadcastState(room: RoyaleRoom) {
    const dto = roomToStateDTO(room);
    for (const pid of [...room.participantIds, ...room.spectatorIds]) {
      this.io.to(`user:${pid}`).emit("royale:state", dto);
    }
  }
}
