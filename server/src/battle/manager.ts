import { randomUUID } from "crypto";
import { Server as IOServer } from "socket.io";
import {
  BATTLE_DRAW_REWARD,
  BATTLE_LOSE_REWARD,
  BATTLE_WIN_REWARD,
  CHALLENGE_TIMEOUT_MS,
  CHARACTER_SELECT_TIMEOUT_MS,
  ITEMS,
  MAX_BATTLE_ROUNDS,
  ROUND_ACTION_TIMEOUT_MS,
  ROUND_INTERMISSION_MS,
  STEP_REPLAY_BUFFER_MS,
  STEP_REPLAY_MS,
} from "@identity-slot/game-core";
import { prisma } from "../lib/prisma";
import { sendPushToUser, sendPushToUsers } from "../lib/push";
import { isUserOnline } from "../socket/presence";
import { roomToStateDTO } from "./dto";
import { buildFighter, resolveRound } from "./engine";
import { BattleRoom, BattleSettings, PendingAction, PendingChallenge } from "./types";

export class UserFacingError extends Error {}

const MIN_ROUNDS = 3;
const MAX_ROUNDS_CAP = 30;

function normalizeSettings(input: Partial<BattleSettings> | undefined): BattleSettings {
  const maxRoundsRaw = input?.maxRounds ?? MAX_BATTLE_ROUNDS;
  const maxRounds = Math.min(MAX_ROUNDS_CAP, Math.max(MIN_ROUNDS, Math.round(maxRoundsRaw)));
  const itemsAllowed = input?.itemsAllowed ?? true;
  return { maxRounds, itemsAllowed };
}

export class BattleManager {
  private io: IOServer;
  private challenges = new Map<string, PendingChallenge>();
  private rooms = new Map<string, BattleRoom>();
  private roomByUser = new Map<string, string>();

  constructor(io: IOServer) {
    this.io = io;
  }

  async createChallenge(fromUserId: string, toUserId: string, settingsInput?: Partial<BattleSettings>) {
    if (fromUserId === toUserId) throw new UserFacingError("自分には挑戦できません。");
    if (this.roomByUser.has(fromUserId)) throw new UserFacingError("あなたはすでに別のバトル中です。");
    if (this.roomByUser.has(toUserId)) throw new UserFacingError("相手は別のバトル中です。");
    if (!isUserOnline(toUserId)) throw new UserFacingError("相手はオフラインです。");

    const [fromUser, toUser, fromCharCount] = await Promise.all([
      prisma.user.findUnique({ where: { id: fromUserId } }),
      prisma.user.findUnique({ where: { id: toUserId } }),
      prisma.character.count({ where: { userId: fromUserId, soldAt: null } }),
    ]);
    if (!fromUser || !toUser) throw new UserFacingError("ユーザーが見つかりません。");
    if (fromCharCount === 0) throw new UserFacingError("あなたはまだキャラクターがいません。先にガチャを引いてください。");

    const settings = normalizeSettings(settingsInput);
    const id = randomUUID();
    const timer = setTimeout(() => this.expireChallenge(id), CHALLENGE_TIMEOUT_MS);
    const challenge: PendingChallenge = {
      id,
      fromUserId,
      fromDisplayName: fromUser.displayName,
      toUserId,
      toDisplayName: toUser.displayName,
      expiresAt: Date.now() + CHALLENGE_TIMEOUT_MS,
      timer,
      settings,
    };
    this.challenges.set(id, challenge);

    this.emitToUser(toUserId, "battle:challengeReceived", {
      challengeId: id,
      from: { id: fromUserId, displayName: fromUser.displayName },
      expiresAt: challenge.expiresAt,
      settings,
    });

    sendPushToUser(toUserId, {
      title: "⚔️ バトルの挑戦が届きました",
      body: `${fromUser.displayName} があなたに挑戦しています!`,
      url: "/battle",
      tag: "battle-challenge",
    }).catch((err) => console.error("[push] challenge notify failed", err));

    return { challengeId: id };
  }

  private expireChallenge(challengeId: string) {
    const c = this.challenges.get(challengeId);
    if (!c) return;
    this.challenges.delete(challengeId);
    this.emitToUser(c.fromUserId, "battle:challengeUpdate", { challengeId, status: "expired" });
    this.emitToUser(c.toUserId, "battle:challengeUpdate", { challengeId, status: "expired" });
  }

  async respondChallenge(challengeId: string, byUserId: string, accept: boolean) {
    const c = this.challenges.get(challengeId);
    if (!c) throw new UserFacingError("この挑戦は既に無効です。");
    if (c.toUserId !== byUserId) throw new UserFacingError("この挑戦に応答する権限がありません。");

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

    const room = this.createRoom(c.fromUserId, c.toUserId, c.settings);
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

  private createRoom(userA: string, userB: string, settings: BattleSettings): BattleRoom {
    const room: BattleRoom = {
      id: randomUUID(),
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
      settings,
      spectatorIds: new Set(),
      spectatorNames: {},
      chatLog: [],
    };
    this.rooms.set(room.id, room);
    this.roomByUser.set(userA, room.id);
    this.roomByUser.set(userB, room.id);

    room.selectTimer = setTimeout(() => this.handleSelectTimeout(room.id), CHARACTER_SELECT_TIMEOUT_MS);
    this.broadcastActiveList();

    return room;
  }

  getRoomForUser(userId: string): BattleRoom | undefined {
    const roomId = this.roomByUser.get(userId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  joinRoom(roomId: string, userId: string) {
    const room = this.requireRoomMember(roomId, userId);
    this.broadcastState(room);
  }

  listActiveBattles() {
    return [...this.rooms.values()]
      .filter((r) => r.phase !== "finished")
      .map((r) => ({
        roomId: r.id,
        phase: r.phase,
        roundNo: r.roundNo,
        players: r.userIds.map((uid) => r.fighters[uid]?.displayName ?? "プレイヤー"),
        spectatorCount: r.spectatorIds.size,
      }));
  }

  private broadcastActiveList() {
    this.io.emit("battle:activeUpdated", { battles: this.listActiveBattles() });
  }

  async spectate(roomId: string, userId: string) {
    const room = this.rooms.get(roomId);
    if (!room) throw new UserFacingError("バトルが見つかりません。");
    if (room.userIds.includes(userId)) throw new UserFacingError("対戦者は観戦できません。");
    room.spectatorIds.add(userId);
    if (!room.spectatorNames[userId]) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      room.spectatorNames[userId] = user?.displayName ?? "観戦者";
    }
    this.sendStateTo(room, userId);
    this.broadcastActiveList();
  }

  unspectate(roomId: string, userId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.spectatorIds.delete(userId);
    this.broadcastActiveList();
  }

  sendChatMessage(roomId: string, userId: string, text: string) {
    const room = this.rooms.get(roomId);
    if (!room) throw new UserFacingError("バトルが見つかりません。");
    const isMember = room.userIds.includes(userId) || room.spectatorIds.has(userId);
    if (!isMember) throw new UserFacingError("このバトルの参加者・観戦者ではありません。");

    const trimmed = text.trim();
    if (!trimmed) throw new UserFacingError("メッセージを入力してください。");
    if (trimmed.length > 200) throw new UserFacingError("メッセージは200文字以内にしてください。");

    const displayName = room.fighters[userId]?.displayName ?? room.spectatorNames[userId] ?? "観戦者";
    const message = { userId, displayName, text: trimmed, at: Date.now() };
    room.chatLog.push(message);
    if (room.chatLog.length > 50) room.chatLog.shift();

    for (const uid of [...room.userIds, ...room.spectatorIds]) {
      this.emitToUser(uid, "battle:chat", message);
    }
  }

  async selectCharacter(roomId: string, userId: string, characterId: string) {
    const room = this.requireRoomMember(roomId, userId);
    if (room.phase !== "select") throw new UserFacingError("すでにキャラクターが選択されています。");
    if (room.fighters[userId]) throw new UserFacingError("すでに選択済みです。");

    const [character, user] = await Promise.all([
      prisma.character.findFirst({ where: { id: characterId, userId, soldAt: null } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);
    if (!character) throw new UserFacingError("キャラクターが見つかりません。");
    if (!user) throw new UserFacingError("ユーザーが見つかりません。");

    room.fighters[userId] = buildFighter(character, userId, user.displayName);

    const [p1, p2] = room.userIds;
    if (room.fighters[p1] && room.fighters[p2]) {
      if (room.selectTimer) {
        clearTimeout(room.selectTimer);
        room.selectTimer = null;
      }
      room.phase = "round";
      this.startRound(room);
    } else {
      this.broadcastState(room);
    }
  }

  private startRound(room: BattleRoom) {
    room.roundNo += 1;
    room.pending = {};

    if (room.roundNo > room.settings.maxRounds) {
      this.finishByHp(room);
      return;
    }

    room.roundTimer = setTimeout(() => this.handleRoundTimeout(room.id, room.roundNo), ROUND_ACTION_TIMEOUT_MS);
    this.broadcastState(room);

    // ラウンド1はキャラ選択直後で両者ともすでにアプリを見ているため通知は不要。
    // 2ラウンド目以降(判定待ちの間隔を空けて再度行動が必要になったタイミング)のみ知らせる。
    if (room.roundNo > 1) {
      sendPushToUsers(room.userIds, {
        title: "⚔️ あなたの番です",
        body: "バトルの行動を選択してください。",
        url: `/battle/${room.id}`,
        tag: "battle-turn",
      }).catch((err) => console.error("[push] battle turn notify failed", err));
    }
  }

  async submitAction(roomId: string, userId: string, action: PendingAction) {
    const room = this.requireRoomMember(roomId, userId);
    if (room.phase !== "round") throw new UserFacingError("現在は行動を選択できません。");
    if (room.pending[userId]) throw new UserFacingError("すでに行動を選択済みです。");

    const fighter = room.fighters[userId]!;
    const opponentId = room.userIds.find((id) => id !== userId)!;

    if (action.type === "special") {
      if (!fighter.hasSpecial || fighter.specialCooldown > 0) throw new UserFacingError("とくぎはまだ使えません。");
    }
    if (action.type === "gamble") {
      if (!fighter.hasGamble || fighter.gambleCooldown > 0) {
        throw new UserFacingError("一か八かの技はまだ使えません。");
      }
    }
    if (action.type === "item") {
      if (!room.settings.itemsAllowed) throw new UserFacingError("このバトルではアイテム使用が禁止されています。");
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

    // 直前の非同期処理(アイテムDB更新)中にラウンドが別要因で進行/終了していないか確認
    if (room.phase !== "round" || room.pending[userId]) return;

    room.pending[userId] = action;

    if (room.pending[userId] && room.pending[opponentId]) {
      if (room.roundTimer) {
        clearTimeout(room.roundTimer);
        room.roundTimer = null;
      }
      this.resolveAndContinue(room);
    } else {
      this.broadcastState(room);
    }
  }

  private handleRoundTimeout(roomId: string, roundNo: number) {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== "round" || room.roundNo !== roundNo || room.resolving) return;
    const [p1, p2] = room.userIds;
    if (room.pending[p1] && room.pending[p2]) return;
    room.log.push(`⌛ ${ROUND_ACTION_TIMEOUT_MS / 1000}秒経過。未選択のプレイヤーは自動的に「こうげき」を行います。`);
    this.resolveAndContinue(room);
  }

  private resolveAndContinue(room: BattleRoom) {
    if (room.resolving) return;
    room.resolving = true;
    let steps: ReturnType<typeof resolveRound> = [];
    try {
      steps = resolveRound(room);
    } finally {
      room.resolving = false;
    }
    room.lastRoundSteps = steps;

    const [p1, p2] = room.userIds;
    const f1 = room.fighters[p1]!;
    const f2 = room.fighters[p2]!;
    const f1Down = f1.hp <= 0;
    const f2Down = f2.hp <= 0;

    if (f1Down || f2Down) {
      let winner: string | "draw" = "draw";
      if (f1Down && !f2Down) winner = p2;
      else if (f2Down && !f1Down) winner = p1;
      this.finish(room, winner).catch((err) => console.error("[battle finish]", err));
      return;
    }

    // ラウンド結果をすぐに反映して見せてから、クライアントが行動ステップを1手ずつ(約2秒間隔で)
    // 再生し終える時間だけ待ってから次のラウンドへ進める(連打で瞬時に決着してしまうのを防ぐ)
    this.broadcastState(room);
    const delay = Math.max(ROUND_INTERMISSION_MS, steps.length * STEP_REPLAY_MS + STEP_REPLAY_BUFFER_MS);
    setTimeout(() => {
      if (room.phase === "round") this.startRound(room);
    }, delay);
  }

  private finishByHp(room: BattleRoom) {
    const [p1, p2] = room.userIds;
    const f1 = room.fighters[p1]!;
    const f2 = room.fighters[p2]!;
    let winner: string | "draw" = "draw";
    if (f1.hp > f2.hp) winner = p1;
    else if (f2.hp > f1.hp) winner = p2;
    this.finish(room, winner).catch((err) => console.error("[battle finish]", err));
  }

  async retire(roomId: string, userId: string) {
    const room = this.requireRoomMember(roomId, userId);
    if (room.phase === "finished") return;

    if (room.phase === "select") {
      this.cancelRoom(room, `🏳️ ${this.displayNameOf(room, userId)} が退出したため、バトルは中止されました。`);
      return;
    }

    if (room.roundTimer) {
      clearTimeout(room.roundTimer);
      room.roundTimer = null;
    }
    const fighter = room.fighters[userId]!;
    fighter.hp = 0;
    fighter.retired = true;
    room.log.push(`🏳️ ${fighter.displayName} がリタイアしました。`);
    const opponentId = room.userIds.find((id) => id !== userId)!;
    await this.finish(room, opponentId);
  }

  private cancelRoom(room: BattleRoom, message: string) {
    room.phase = "finished";
    room.winnerUserId = null;
    room.log.push(message);
    if (room.selectTimer) clearTimeout(room.selectTimer);
    if (room.roundTimer) clearTimeout(room.roundTimer);
    this.broadcastState(room);
    this.cleanupRoom(room);
  }

  private handleSelectTimeout(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== "select") return;
    this.cancelRoom(room, "⌛ キャラクター選択がタイムアウトしたため、バトルは中止されました。");
  }

  private async finish(room: BattleRoom, winner: string | "draw") {
    room.phase = "finished";
    room.winnerUserId = winner;
    const [p1, p2] = room.userIds;

    if (winner === "draw") {
      room.rewards[p1] = BATTLE_DRAW_REWARD;
      room.rewards[p2] = BATTLE_DRAW_REWARD;
      room.log.push("💥 DRAW! 決着つかず。");
    } else {
      const loser = winner === p1 ? p2 : p1;
      room.rewards[winner] = BATTLE_WIN_REWARD;
      room.rewards[loser] = BATTLE_LOSE_REWARD;
      room.log.push(`🏆 ${room.fighters[winner]?.displayName ?? "勝者"} の勝利!`);
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: p1 }, data: { money: { increment: room.rewards[p1] ?? 0 } } }),
      prisma.user.update({ where: { id: p2 }, data: { money: { increment: room.rewards[p2] ?? 0 } } }),
    ]);

    this.broadcastState(room);
    this.cleanupRoom(room);
  }

  private cleanupRoom(room: BattleRoom) {
    for (const uid of room.userIds) {
      if (this.roomByUser.get(uid) === room.id) this.roomByUser.delete(uid);
    }
    this.broadcastActiveList();
    setTimeout(() => this.rooms.delete(room.id), 5 * 60 * 1000);
  }

  handleDisconnect(userId: string) {
    const room = this.getRoomForUser(userId);
    if (!room || room.phase === "finished") return;

    // 60秒: 無料ホスティングのコールドスタートやDB再接続を挟んだリロードでも
    // 復帰できるよう、切断からリタイア扱いまでに十分な猶予を持たせる
    setTimeout(() => {
      if (isUserOnline(userId)) return;
      const stillRoom = this.getRoomForUser(userId);
      if (!stillRoom || stillRoom.id !== room.id || stillRoom.phase === "finished") return;
      this.retire(room.id, userId).catch((err) => console.error("[battle disconnect retire]", err));
    }, 60_000);
  }

  private requireRoomMember(roomId: string, userId: string): BattleRoom {
    const room = this.rooms.get(roomId);
    if (!room) throw new UserFacingError("バトルが見つかりません。");
    if (!room.userIds.includes(userId)) throw new UserFacingError("このバトルの参加者ではありません。");
    return room;
  }

  private displayNameOf(room: BattleRoom, userId: string): string {
    return room.fighters[userId]?.displayName ?? "プレイヤー";
  }

  private broadcastState(room: BattleRoom) {
    const dto = roomToStateDTO(room);
    for (const uid of [...room.userIds, ...room.spectatorIds]) {
      this.emitToUser(uid, "battle:state", dto);
    }
  }

  private sendStateTo(room: BattleRoom, userId: string) {
    this.emitToUser(userId, "battle:state", roomToStateDTO(room));
  }

  private emitToUser(userId: string, event: string, payload: unknown) {
    this.io.to(`user:${userId}`).emit(event, payload);
  }
}
