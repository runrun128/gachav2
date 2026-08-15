import { Router } from "express";
import { z } from "zod";
import { ITEMS, MARKET_MAX_PRICE, Rarity, isCharacterSellable } from "@identity-slot/game-core";
import { CharacterUnavailableError, transferCharacterOwnership } from "../lib/characterTransfer";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const marketRouter = Router();

marketRouter.use(requireAuth);

marketRouter.get("/market", async (_req, res) => {
  const listings = await prisma.tradeListing.findMany({ orderBy: { createdAt: "desc" }, take: 100 });

  const characterIds = listings
    .filter((l) => l.kind === "character" && l.characterId)
    .map((l) => l.characterId!);
  const characters = characterIds.length
    ? await prisma.character.findMany({ where: { id: { in: characterIds } } })
    : [];
  const characterById = new Map(characters.map((c) => [c.id, c]));

  const sellerIds = [...new Set(listings.map((l) => l.sellerId))];
  const sellers = sellerIds.length
    ? await prisma.user.findMany({ where: { id: { in: sellerIds } }, select: { id: true, displayName: true } })
    : [];
  const sellerNameById = new Map(sellers.map((s) => [s.id, s.displayName]));

  res.json({
    listings: listings.map((l) => ({
      id: l.id,
      sellerId: l.sellerId,
      sellerDisplayName: sellerNameById.get(l.sellerId) ?? "不明",
      kind: l.kind,
      price: l.price,
      createdAt: l.createdAt,
      character: l.kind === "character" && l.characterId ? characterById.get(l.characterId) ?? null : null,
      itemKey: l.itemKey,
      itemQuantity: l.itemQuantity,
      item: l.kind === "item" && l.itemKey ? (ITEMS[l.itemKey] ?? null) : null,
    })),
  });
});

const createListingSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("character"),
    characterId: z.string().min(1),
    price: z.coerce.number().int().min(1).max(MARKET_MAX_PRICE),
  }),
  z.object({
    kind: z.literal("item"),
    itemKey: z.string().min(1),
    itemQuantity: z.coerce.number().int().min(1).max(999),
    price: z.coerce.number().int().min(1).max(MARKET_MAX_PRICE),
  }),
]);

marketRouter.post("/market/list", async (req, res) => {
  const parsed = createListingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "入力内容が不正です。" });
  const userId = req.user!.id;
  const data = parsed.data;

  if (data.kind === "character") {
    const character = await prisma.character.findFirst({
      where: { id: data.characterId, userId, soldAt: null },
    });
    if (!character) return res.status(404).json({ error: "キャラクターが見つかりません。" });
    const rarity = character.rarity as Rarity;
    if (!isCharacterSellable(rarity, character.isExclusive)) {
      return res.status(400).json({ error: "このキャラクターは出品できません。" });
    }
    const existing = await prisma.tradeListing.findFirst({ where: { characterId: data.characterId } });
    if (existing) return res.status(400).json({ error: "すでに出品中です。" });

    const listing = await prisma.tradeListing.create({
      data: { sellerId: userId, kind: "character", characterId: data.characterId, price: data.price },
    });
    return res.status(201).json({ listing });
  }

  if (!ITEMS[data.itemKey]) return res.status(400).json({ error: "存在しないアイテムです。" });

  try {
    const listing = await prisma.$transaction(async (tx) => {
      const inv = await tx.inventoryItem.findUnique({ where: { userId_itemKey: { userId, itemKey: data.itemKey } } });
      if (!inv || inv.quantity < data.itemQuantity) throw new Error("INSUFFICIENT_ITEMS");

      // 出品と同時に在庫からエスクロー(即時減算)し、複数出品による売り越しを防ぐ
      const invUpdate = await tx.inventoryItem.updateMany({
        where: { userId, itemKey: data.itemKey, quantity: inv.quantity },
        data: { quantity: { decrement: data.itemQuantity } },
      });
      if (invUpdate.count === 0) throw new Error("LIST_CONFLICT");

      return tx.tradeListing.create({
        data: { sellerId: userId, kind: "item", itemKey: data.itemKey, itemQuantity: data.itemQuantity, price: data.price },
      });
    });
    res.status(201).json({ listing });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_ITEMS") {
      return res.status(400).json({ error: "そのアイテムを持っていません。" });
    }
    if (err instanceof Error && err.message === "LIST_CONFLICT") {
      return res.status(409).json({ error: "他の操作と競合しました。もう一度お試しください。" });
    }
    throw err;
  }
});

marketRouter.post("/market/:id/buy", async (req, res) => {
  const buyerId = req.user!.id;
  const listingId = req.params.id;

  try {
    const buyer = await prisma.$transaction(async (tx) => {
      const listing = await tx.tradeListing.findUnique({ where: { id: listingId } });
      if (!listing) throw new Error("NOT_FOUND");
      if (listing.sellerId === buyerId) throw new Error("SELF_BUY");

      const buyerUpdate = await tx.user.updateMany({
        where: { id: buyerId, money: { gte: listing.price } },
        data: { money: { decrement: listing.price } },
      });
      if (buyerUpdate.count === 0) throw new Error("INSUFFICIENT_MONEY");

      // 出品削除を条件付きで先に行い、同時購入や出品取り消しとの競合を防ぐ
      // (削除0件=すでに他の人が買った/キャンセルされた、なのでロールバックする)
      const deleted = await tx.tradeListing.deleteMany({ where: { id: listingId } });
      if (deleted.count === 0) throw new Error("ALREADY_SOLD");

      await tx.user.update({ where: { id: listing.sellerId }, data: { money: { increment: listing.price } } });

      if (listing.kind === "character" && listing.characterId) {
        await transferCharacterOwnership(tx, listing.characterId, listing.sellerId, buyerId);
      } else if (listing.kind === "item" && listing.itemKey && listing.itemQuantity) {
        await tx.inventoryItem.upsert({
          where: { userId_itemKey: { userId: buyerId, itemKey: listing.itemKey } },
          create: { userId: buyerId, itemKey: listing.itemKey, quantity: listing.itemQuantity },
          update: { quantity: { increment: listing.itemQuantity } },
        });
      }

      return tx.user.findUniqueOrThrow({ where: { id: buyerId } });
    });
    res.json({ money: buyer.money });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") return res.status(404).json({ error: "出品が見つかりません。" });
    if (err instanceof Error && err.message === "SELF_BUY") return res.status(400).json({ error: "自分の出品は購入できません。" });
    if (err instanceof Error && err.message === "INSUFFICIENT_MONEY") return res.status(400).json({ error: "コインが足りません。" });
    if (err instanceof Error && err.message === "ALREADY_SOLD") return res.status(409).json({ error: "すでに売却済みか、出品が取り消されています。" });
    if (err instanceof CharacterUnavailableError) return res.status(409).json({ error: "すでに売却済みか、出品が取り消されています。" });
    throw err;
  }
});

marketRouter.delete("/market/:id", async (req, res) => {
  const userId = req.user!.id;
  const listing = await prisma.tradeListing.findUnique({ where: { id: req.params.id } });
  if (!listing) return res.status(404).json({ error: "出品が見つかりません。" });
  if (listing.sellerId !== userId) return res.status(403).json({ error: "自分の出品のみキャンセルできます。" });

  await prisma.$transaction(async (tx) => {
    await tx.tradeListing.delete({ where: { id: listing.id } });
    if (listing.kind === "item" && listing.itemKey && listing.itemQuantity) {
      await tx.inventoryItem.upsert({
        where: { userId_itemKey: { userId, itemKey: listing.itemKey } },
        create: { userId, itemKey: listing.itemKey, quantity: listing.itemQuantity },
        update: { quantity: { increment: listing.itemQuantity } },
      });
    }
  });
  res.status(204).end();
});
