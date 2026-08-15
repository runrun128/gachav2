import { randomUUID } from "crypto";
import { Server as IOServer } from "socket.io";
import { ITEMS, Rarity, TRADE_INVITE_TIMEOUT_MS, TRADE_MAX_COINS, TRADE_MAX_OFFER_CHARACTERS, isCharacterSellable } from "@identity-slot/game-core";
import { transferCharacterOwnership } from "../lib/characterTransfer";
import { prisma } from "../lib/prisma";
import { isUserOnline } from "../socket/presence";
import { roomToStateDTO } from "./dto";
import { PendingTradeInvite, TradeOffer, TradeOfferItem, TradeRoom } from "./types";

export class UserFacingError extends Error {}

function emptyOffer(): TradeOffer {
  return { characterIds: [], items: [], coins: 0, confirmed: false };
}

export interface UpdateOfferInput {
  characterIds: string[];
  items: TradeOfferItem[];
  coins: number;
}

export class TradeManager {
  private io: IOServer;
  private invites = new Map<string, PendingTradeInvite>();
  private rooms = new Map<string, TradeRoom>();
  private roomByUser = new Map<string, string>();

  constructor(io: IOServer) {
    this.io = io;
  }

  async createInvite(fromUserId: string, toUserId: string) {
    if (fromUserId === toUserId) throw new UserFacingError("自分にはトレードを申し込めません。");
    if (this.roomByUser.has(fromUserId)) throw new UserFacingError("あなたはすでに別のトレード中です。");
    if (this.roomByUser.has(toUserId)) throw new UserFacingError("相手は別のトレード中です。");
    if (!isUserOnline(toUserId)) throw new UserFacingError("相手はオフラインです。");

    const [fromUser, toUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: fromUserId } }),
      prisma.user.findUnique({ where: { id: toUserId } }),
    ]);
    if (!fromUser || !toUser) throw new UserFacingError("ユーザーが見つかりません。");

    const id = randomUUID();
    const timer = setTimeout(() => this.expireInvite(id), TRADE_INVITE_TIMEOUT_MS);
    const invite: PendingTradeInvite = {
      id,
      fromUserId,
      fromDisplayName: fromUser.displayName,
      toUserId,
      toDisplayName: toUser.displayName,
      expiresAt: Date.now() + TRADE_INVITE_TIMEOUT_MS,
      timer,
    };
    this.invites.set(id, invite);

    this.emitToUser(toUserId, "trade:inviteReceived", {
      inviteId: id,
      from: { id: fromUserId, displayName: fromUser.displayName },
      expiresAt: invite.expiresAt,
    });

    return { inviteId: id };
  }

  private expireInvite(inviteId: string) {
    const inv = this.invites.get(inviteId);
    if (!inv) return;
    this.invites.delete(inviteId);
    this.emitToUser(inv.fromUserId, "trade:inviteUpdate", { inviteId, status: "expired" });
    this.emitToUser(inv.toUserId, "trade:inviteUpdate", { inviteId, status: "expired" });
  }

  async respondInvite(inviteId: string, byUserId: string, accept: boolean) {
    const inv = this.invites.get(inviteId);
    if (!inv) throw new UserFacingError("この招待は既に無効です。");
    if (inv.toUserId !== byUserId) throw new UserFacingError("この招待に応答する権限がありません。");

    clearTimeout(inv.timer);
    this.invites.delete(inviteId);

    if (!accept) {
      this.emitToUser(inv.fromUserId, "trade:inviteUpdate", { inviteId, status: "declined" });
      return { accepted: false };
    }

    if (this.roomByUser.has(inv.fromUserId) || this.roomByUser.has(inv.toUserId)) {
      this.emitToUser(inv.fromUserId, "trade:inviteUpdate", {
        inviteId,
        status: "error",
        message: "相手はすでに別のトレード中です。",
      });
      throw new UserFacingError("すでに別のトレード中です。");
    }

    const room: TradeRoom = {
      id: randomUUID(),
      userIds: [inv.fromUserId, inv.toUserId],
      displayNames: { [inv.fromUserId]: inv.fromDisplayName, [inv.toUserId]: inv.toDisplayName },
      offers: { [inv.fromUserId]: emptyOffer(), [inv.toUserId]: emptyOffer() },
      createdAt: Date.now(),
    };
    this.rooms.set(room.id, room);
    this.roomByUser.set(inv.fromUserId, room.id);
    this.roomByUser.set(inv.toUserId, room.id);

    this.emitToUser(inv.fromUserId, "trade:roomReady", {
      roomId: room.id,
      partner: { id: inv.toUserId, displayName: inv.toDisplayName },
    });
    this.emitToUser(inv.toUserId, "trade:roomReady", {
      roomId: room.id,
      partner: { id: inv.fromUserId, displayName: inv.fromDisplayName },
    });

    return { accepted: true, roomId: room.id };
  }

  getRoomForUser(userId: string): TradeRoom | undefined {
    const roomId = this.roomByUser.get(userId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  async joinRoom(roomId: string, userId: string) {
    const room = this.requireRoomMember(roomId, userId);
    await this.broadcastState(room);
  }

  async updateOffer(roomId: string, userId: string, input: UpdateOfferInput) {
    const room = this.requireRoomMember(roomId, userId);

    if (input.characterIds.length > TRADE_MAX_OFFER_CHARACTERS) {
      throw new UserFacingError(`キャラクターは最大${TRADE_MAX_OFFER_CHARACTERS}体までです。`);
    }
    if (new Set(input.characterIds).size !== input.characterIds.length) {
      throw new UserFacingError("同じキャラクターが重複しています。");
    }
    const coins = Math.max(0, Math.min(TRADE_MAX_COINS, Math.round(input.coins) || 0));

    if (input.characterIds.length > 0) {
      const characters = await prisma.character.findMany({
        where: { id: { in: input.characterIds }, userId, soldAt: null },
      });
      if (characters.length !== input.characterIds.length) {
        throw new UserFacingError("所持していないキャラクターが含まれています。");
      }
      for (const c of characters) {
        if (!isCharacterSellable(c.rarity as Rarity, c.isExclusive)) {
          throw new UserFacingError("譲渡できないキャラクターが含まれています。");
        }
      }
      const listed = await prisma.tradeListing.findFirst({ where: { characterId: { in: input.characterIds } } });
      if (listed) throw new UserFacingError("マーケットに出品中のキャラクターは含められません。");
    }

    const items: TradeOfferItem[] = [];
    for (const raw of input.items) {
      if (!ITEMS[raw.itemKey]) throw new UserFacingError("存在しないアイテムです。");
      const qty = Math.round(raw.quantity);
      if (qty <= 0) continue;
      items.push({ itemKey: raw.itemKey, quantity: Math.min(qty, 999) });
    }
    if (items.length > 0) {
      const inv = await prisma.inventoryItem.findMany({
        where: { userId, itemKey: { in: items.map((i) => i.itemKey) } },
      });
      const invByKey = new Map(inv.map((i) => [i.itemKey, i.quantity]));
      for (const i of items) {
        if ((invByKey.get(i.itemKey) ?? 0) < i.quantity) {
          throw new UserFacingError("所持数を超えるアイテムが含まれています。");
        }
      }
    }

    room.offers[userId] = { characterIds: input.characterIds, items, coins, confirmed: false };
    // 内容が変わったので両者とも確認し直す必要がある
    const opponentId = room.userIds.find((id) => id !== userId)!;
    room.offers[opponentId].confirmed = false;

    await this.broadcastState(room);
  }

  async confirm(roomId: string, userId: string) {
    const room = this.requireRoomMember(roomId, userId);
    room.offers[userId].confirmed = true;

    const [p1, p2] = room.userIds;
    if (room.offers[p1].confirmed && room.offers[p2].confirmed) {
      await this.execute(room);
    } else {
      await this.broadcastState(room);
    }
  }

  private async execute(room: TradeRoom) {
    const [p1, p2] = room.userIds;
    const offer1 = room.offers[p1];
    const offer2 = room.offers[p2];

    try {
      await prisma.$transaction(async (tx) => {
        if (offer1.coins > 0) {
          const r = await tx.user.updateMany({
            where: { id: p1, money: { gte: offer1.coins } },
            data: { money: { decrement: offer1.coins } },
          });
          if (r.count === 0) throw new UserFacingError(`${room.displayNames[p1]}のコインが不足しています。`);
        }
        if (offer2.coins > 0) {
          const r = await tx.user.updateMany({
            where: { id: p2, money: { gte: offer2.coins } },
            data: { money: { decrement: offer2.coins } },
          });
          if (r.count === 0) throw new UserFacingError(`${room.displayNames[p2]}のコインが不足しています。`);
        }
        if (offer2.coins > 0) await tx.user.update({ where: { id: p1 }, data: { money: { increment: offer2.coins } } });
        if (offer1.coins > 0) await tx.user.update({ where: { id: p2 }, data: { money: { increment: offer1.coins } } });

        for (const item of offer1.items) {
          const r = await tx.inventoryItem.updateMany({
            where: { userId: p1, itemKey: item.itemKey, quantity: { gte: item.quantity } },
            data: { quantity: { decrement: item.quantity } },
          });
          if (r.count === 0) throw new UserFacingError(`${room.displayNames[p1]}のアイテムが不足しています。`);
          await tx.inventoryItem.upsert({
            where: { userId_itemKey: { userId: p2, itemKey: item.itemKey } },
            create: { userId: p2, itemKey: item.itemKey, quantity: item.quantity },
            update: { quantity: { increment: item.quantity } },
          });
        }
        for (const item of offer2.items) {
          const r = await tx.inventoryItem.updateMany({
            where: { userId: p2, itemKey: item.itemKey, quantity: { gte: item.quantity } },
            data: { quantity: { decrement: item.quantity } },
          });
          if (r.count === 0) throw new UserFacingError(`${room.displayNames[p2]}のアイテムが不足しています。`);
          await tx.inventoryItem.upsert({
            where: { userId_itemKey: { userId: p1, itemKey: item.itemKey } },
            create: { userId: p1, itemKey: item.itemKey, quantity: item.quantity },
            update: { quantity: { increment: item.quantity } },
          });
        }

        for (const characterId of offer1.characterIds) {
          await transferCharacterOwnership(tx, characterId, p1, p2);
        }
        for (const characterId of offer2.characterIds) {
          await transferCharacterOwnership(tx, characterId, p2, p1);
        }
      });

      this.emitToUser(p1, "trade:completed", { roomId: room.id });
      this.emitToUser(p2, "trade:completed", { roomId: room.id });
    } catch (err) {
      // 確定後に他の操作(先に別トレードで手放す等)で状況が変わった場合はここに来る。
      // ルームは維持し、両者の確認だけ解除して再調整できるようにする。
      room.offers[p1].confirmed = false;
      room.offers[p2].confirmed = false;
      const message = err instanceof Error ? err.message : "トレードの成立に失敗しました。もう一度確認してください。";
      this.emitToUser(p1, "trade:failed", { roomId: room.id, message });
      this.emitToUser(p2, "trade:failed", { roomId: room.id, message });
      await this.broadcastState(room);
      return;
    }

    this.cleanupRoom(room);
  }

  cancel(roomId: string, userId: string) {
    const room = this.requireRoomMember(roomId, userId);
    for (const uid of room.userIds) {
      this.emitToUser(uid, "trade:cancelled", { roomId: room.id, byUserId: userId });
    }
    this.cleanupRoom(room);
  }

  handleDisconnect(userId: string) {
    const room = this.getRoomForUser(userId);
    if (!room) return;
    const opponentId = room.userIds.find((id) => id !== userId)!;
    this.emitToUser(opponentId, "trade:cancelled", { roomId: room.id, byUserId: userId, reason: "disconnect" });
    this.cleanupRoom(room);
  }

  private cleanupRoom(room: TradeRoom) {
    for (const uid of room.userIds) {
      if (this.roomByUser.get(uid) === room.id) this.roomByUser.delete(uid);
    }
    this.rooms.delete(room.id);
  }

  private requireRoomMember(roomId: string, userId: string): TradeRoom {
    const room = this.rooms.get(roomId);
    if (!room) throw new UserFacingError("トレードが見つかりません。");
    if (!room.userIds.includes(userId)) throw new UserFacingError("このトレードの参加者ではありません。");
    return room;
  }

  private async broadcastState(room: TradeRoom) {
    const dto = await roomToStateDTO(room);
    for (const uid of room.userIds) {
      this.emitToUser(uid, "trade:state", dto);
    }
  }

  private emitToUser(userId: string, event: string, payload: unknown) {
    this.io.to(`user:${userId}`).emit(event, payload);
  }
}
