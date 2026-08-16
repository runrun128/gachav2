import { randomUUID } from "crypto";
import { Server as IOServer } from "socket.io";
import {
  TOURNAMENT_BRACKET_SIZES,
  TOURNAMENT_CHAMPION_REWARD,
  TOURNAMENT_CHARACTER_SELECT_TIMEOUT_MS,
  TOURNAMENT_PARTICIPATION_REWARD,
  TOURNAMENT_ROUND_INTERMISSION_MS,
  TOURNAMENT_RUNNER_UP_REWARD,
  TournamentBracketSize,
} from "@identity-slot/game-core";
import { prisma } from "../lib/prisma";
import { sendPushToUser } from "../lib/push";
import { isUserOnline } from "../socket/presence";
import { roomToLobbySummary, roomToStateDTO } from "./dto";
import { buildTournamentFighter, freshFighterCopy, shuffleParticipants, simulateDuel } from "./engine";
import { TournamentMatch, TournamentRoom } from "./types";

export class UserFacingError extends Error {}

export class TournamentManager {
  private io: IOServer;
  private rooms = new Map<string, TournamentRoom>();
  private userRoom = new Map<string, string>();

  constructor(io: IOServer) {
    this.io = io;
  }

  private createRoomShell(
    roomName: string,
    bracketSize: TournamentBracketSize,
    hostUserId: string,
    hostDisplayName: string
  ): TournamentRoom {
    return {
      id: randomUUID(),
      roomName,
      hostUserId,
      bracketSize,
      phase: "lobby",
      participantIds: [hostUserId],
      participantNames: { [hostUserId]: hostDisplayName },
      fighterTemplates: {},
      rounds: [],
      currentRound: 0,
      championId: null,
      runnerUpId: null,
      finishReason: null,
      rewards: {},
      createdAt: Date.now(),
      selectTimer: null,
    };
  }

  async createLobby(hostUserId: string, roomName: string, bracketSize: number) {
    const trimmed = roomName.trim();
    if (!trimmed) throw new UserFacingError("部屋の名前を入力してください。");
    if (trimmed.length > 30) throw new UserFacingError("部屋の名前は30文字以内にしてください。");
    if (this.userRoom.has(hostUserId)) throw new UserFacingError("すでに別のトーナメントに参加中です。");
    if (!TOURNAMENT_BRACKET_SIZES.includes(bracketSize as TournamentBracketSize)) {
      throw new UserFacingError("参加人数の指定が不正です。");
    }

    const user = await prisma.user.findUnique({ where: { id: hostUserId } });
    if (!user) throw new UserFacingError("ユーザーが見つかりません。");

    const room = this.createRoomShell(trimmed, bracketSize as TournamentBracketSize, hostUserId, user.displayName);
    this.rooms.set(room.id, room);
    this.userRoom.set(hostUserId, room.id);
    this.broadcastLobbies();
    return { roomId: room.id };
  }

  listLobbies() {
    return [...this.rooms.values()].filter((r) => r.phase === "lobby").map(roomToLobbySummary);
  }

  private broadcastLobbies() {
    this.io.emit("tournament:lobbiesUpdated", { lobbies: this.listLobbies() });
  }

  listActiveTournaments() {
    return [...this.rooms.values()]
      .filter((r) => r.phase === "select" || r.phase === "running")
      .map((r) => ({
        roomId: r.id,
        roomName: r.roomName,
        bracketSize: r.bracketSize,
        phase: r.phase,
        currentRound: r.currentRound,
        participantCount: r.participantIds.length,
      }));
  }

  private broadcastActiveList() {
    this.io.emit("tournament:activeUpdated", { tournaments: this.listActiveTournaments() });
  }

  async joinLobby(roomId: string, userId: string) {
    const room = this.rooms.get(roomId);
    if (!room) throw new UserFacingError("トーナメントが見つかりません。");
    if (room.phase !== "lobby") throw new UserFacingError("すでに開始されたトーナメントです。");
    if (room.participantIds.includes(userId)) return { roomId: room.id };
    if (room.participantIds.length >= room.bracketSize) throw new UserFacingError("満員です。");
    if (this.userRoom.has(userId)) throw new UserFacingError("すでに別のトーナメントに参加中です。");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UserFacingError("ユーザーが見つかりません。");

    room.participantIds.push(userId);
    room.participantNames[userId] = user.displayName;
    this.userRoom.set(userId, room.id);

    this.broadcastState(room);
    this.broadcastLobbies();

    sendPushToUser(room.hostUserId, {
      title: "🏆 トーナメントに参加者が来ました",
      body: `${user.displayName} が「${room.roomName}」に参加しました。`,
      url: `/battle/tournament/${room.id}`,
      tag: "tournament-join",
    }).catch((err) => console.error("[push] tournament join notify failed", err));

    return { roomId: room.id };
  }

  joinRoom(roomId: string, userId: string) {
    const room = this.rooms.get(roomId);
    if (!room) throw new UserFacingError("トーナメントが見つかりません。");
    if (!room.participantIds.includes(userId)) throw new UserFacingError("このトーナメントの参加者ではありません。");
    this.sendState(room, userId);
  }

  getActiveRoomId(userId: string): string | null {
    return this.userRoom.get(userId) ?? null;
  }

  async startTournament(roomId: string, byUserId: string) {
    const room = this.rooms.get(roomId);
    if (!room) throw new UserFacingError("トーナメントが見つかりません。");
    if (room.hostUserId !== byUserId) throw new UserFacingError("主催者のみが開始できます。");
    if (room.phase !== "lobby") throw new UserFacingError("すでに開始されています。");
    if (room.participantIds.length !== room.bracketSize) {
      throw new UserFacingError(`開始には参加者がちょうど${room.bracketSize}人必要です。`);
    }

    room.phase = "select";
    room.selectTimer = setTimeout(() => this.handleSelectTimeout(room.id), TOURNAMENT_CHARACTER_SELECT_TIMEOUT_MS);

    this.broadcastState(room);
    this.broadcastLobbies();
    this.broadcastActiveList();
  }

  async selectCharacter(roomId: string, userId: string, characterId: string) {
    const room = this.requireParticipant(roomId, userId);
    if (room.phase !== "select") throw new UserFacingError("現在はキャラクターを選択できません。");
    if (room.fighterTemplates[userId]) throw new UserFacingError("すでに選択済みです。");

    const character = await prisma.character.findFirst({ where: { id: characterId, userId, soldAt: null } });
    if (!character) throw new UserFacingError("キャラクターが見つかりません。");

    room.fighterTemplates[userId] = buildTournamentFighter(character, userId, room.participantNames[userId] ?? "プレイヤー");

    const allSelected = room.participantIds.every((pid) => !!room.fighterTemplates[pid]);
    if (allSelected) {
      if (room.selectTimer) {
        clearTimeout(room.selectTimer);
        room.selectTimer = null;
      }
      room.phase = "running";
      this.runNextRound(room);
    } else {
      this.broadcastState(room);
    }
  }

  private runNextRound(room: TournamentRoom) {
    const competitors =
      room.currentRound === 0
        ? shuffleParticipants(room.participantIds)
        : room.rounds[room.currentRound - 1].map((m) => m.winnerId!);

    room.currentRound += 1;
    const matches: TournamentMatch[] = [];
    for (let i = 0; i < competitors.length; i += 2) {
      const player1Id = competitors[i];
      const player2Id = competitors[i + 1];
      const f1 = room.fighterTemplates[player1Id]!;
      const f2 = room.fighterTemplates[player2Id]!;
      const result = simulateDuel(freshFighterCopy(f1), freshFighterCopy(f2));
      matches.push({ id: randomUUID(), player1Id, player2Id, winnerId: result.winnerId, log: result.log });
    }
    room.rounds.push(matches);
    this.broadcastState(room);
    this.broadcastActiveList();

    if (matches.length === 1) {
      const final = matches[0];
      const runnerUpId = final.winnerId === final.player1Id ? final.player2Id : final.player1Id;
      setTimeout(() => {
        this.finish(room, final.winnerId!, runnerUpId).catch((err) => console.error("[tournament finish]", err));
      }, TOURNAMENT_ROUND_INTERMISSION_MS);
      return;
    }

    setTimeout(() => {
      if (room.phase === "running") this.runNextRound(room);
    }, TOURNAMENT_ROUND_INTERMISSION_MS);
  }

  private handleSelectTimeout(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== "select") return;
    const allSelected = room.participantIds.every((pid) => !!room.fighterTemplates[pid]);
    if (allSelected) return;
    room.participantIds.forEach((pid) => this.userRoom.delete(pid));
    room.phase = "finished";
    room.finishReason = "キャラクター選択タイムアウト";
    this.broadcastState(room);
    this.cleanupRoom(room);
  }

  async leaveTournament(roomId: string, userId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (!room.participantIds.includes(userId)) return;

    if (room.phase === "lobby") {
      if (room.hostUserId === userId) {
        room.participantIds.forEach((pid) => this.userRoom.delete(pid));
        this.rooms.delete(room.id);
        room.phase = "finished";
        room.finishReason = "主催者が退出したため中止";
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

    // select/running フェーズは自動進行のみで途中復帰の余地がないため、
    // 離脱が発生した時点でトーナメント全体を中止する。
    room.participantIds.forEach((pid) => this.userRoom.delete(pid));
    if (room.selectTimer) clearTimeout(room.selectTimer);
    room.phase = "finished";
    room.finishReason = `${room.participantNames[userId] ?? "参加者"}が離脱したため中止`;
    this.broadcastState(room);
    this.broadcastLobbies();
    this.cleanupRoom(room);
  }

  handleDisconnect(userId: string) {
    const roomId = this.userRoom.get(userId);
    if (!roomId) return;
    setTimeout(() => {
      if (isUserOnline(userId)) return;
      if (this.userRoom.get(userId) !== roomId) return;
      this.leaveTournament(roomId, userId).catch((err) => console.error("[tournament disconnect leave]", err));
    }, 60_000);
  }

  private async finish(room: TournamentRoom, championId: string, runnerUpId: string) {
    room.phase = "finished";
    room.championId = championId;
    room.runnerUpId = runnerUpId;

    const updates: Promise<unknown>[] = [];
    for (const pid of room.participantIds) {
      const amount =
        pid === championId
          ? TOURNAMENT_CHAMPION_REWARD
          : pid === runnerUpId
            ? TOURNAMENT_RUNNER_UP_REWARD
            : TOURNAMENT_PARTICIPATION_REWARD;
      room.rewards[pid] = amount;
      updates.push(prisma.user.update({ where: { id: pid }, data: { money: { increment: amount } } }));
    }
    await Promise.all(updates);

    await prisma.user
      .update({ where: { id: championId }, data: { tournamentWins: { increment: 1 } } })
      .catch((err) => console.error("[tournament] tournamentWins increment failed", err));

    room.participantIds.forEach((pid) => this.userRoom.delete(pid));
    this.broadcastState(room);
    this.broadcastLobbies();
    this.cleanupRoom(room);
  }

  private cleanupRoom(room: TournamentRoom) {
    this.broadcastActiveList();
    setTimeout(() => this.rooms.delete(room.id), 5 * 60 * 1000);
  }

  private requireParticipant(roomId: string, userId: string): TournamentRoom {
    const room = this.rooms.get(roomId);
    if (!room) throw new UserFacingError("トーナメントが見つかりません。");
    if (!room.participantIds.includes(userId)) throw new UserFacingError("このトーナメントの参加者ではありません。");
    return room;
  }

  private sendState(room: TournamentRoom, userId: string) {
    this.io.to(`user:${userId}`).emit("tournament:state", roomToStateDTO(room));
  }

  private broadcastState(room: TournamentRoom) {
    const dto = roomToStateDTO(room);
    for (const pid of room.participantIds) {
      this.io.to(`user:${pid}`).emit("tournament:state", dto);
    }
  }
}
