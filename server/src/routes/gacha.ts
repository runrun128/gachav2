import { Router } from "express";
import { z } from "zod";
import {
  GACHA_COOLDOWN_SECONDS,
  GachaPullType,
  ITEMS,
  ItemDef,
  costForPullType,
  minRarityForPullType,
  spinReels,
  spinLimitedReels,
} from "@identity-slot/game-core";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const gachaRouter = Router();

// ガチャ連打防止のクールダウン(メモリ上のみ・再起動でリセット。Discord版と同じ方式)
const lastGachaAt = new Map<string, number>();

const spinSchema = z.object({
  type: z.enum(["single", "ten", "sr", "ssr"]),
});

gachaRouter.post("/spin", requireAuth, async (req, res) => {
  const parsed = spinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "ガチャの種類が不正です。" });
  }
  const type = parsed.data.type as GachaPullType;
  const userId = req.user!.id;

  const now = Date.now();
  const last = lastGachaAt.get(userId) ?? 0;
  const remaining = GACHA_COOLDOWN_SECONDS - (now - last) / 1000;
  if (remaining > 0) {
    return res.status(429).json({ error: `ガチャは連続で引けません。あと${remaining.toFixed(1)}秒待ってください。` });
  }

  const cost = costForPullType(type);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(401).json({ error: "ログインが必要です。" });
  if (user.money < cost) {
    return res.status(400).json({ error: `コインが足りません。(所持金: ${user.money} / 必要: ${cost})` });
  }

  lastGachaAt.set(userId, now);

  const count = type === "ten" ? 10 : 1;
  const minRarity = type === "ten" ? undefined : minRarityForPullType(type);
  const results = Array.from({ length: count }, () => spinReels(minRarity));

  const [updatedUser] = await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { money: { decrement: cost } } }),
    ...results.map((r) =>
      prisma.character.create({
        data: {
          userId,
          nationality: r.nationality,
          age: r.age,
          gender: r.gender,
          feature: r.feature,
          rarity: r.rarity,
          secretFeature: r.secretFeature,
          specialType: r.specialType,
        },
      })
    ),
  ]);

  res.json({ results, money: updatedUser.money });
});

gachaRouter.get("/limited", requireAuth, async (_req, res) => {
  const banners = await prisma.limitedGacha.findMany({
    where: { active: true },
    select: { key: true, name: true, description: true, cost: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ banners });
});

const limitedSpinParamsSchema = z.object({ key: z.string().min(1) });

gachaRouter.post("/limited/:key/spin", requireAuth, async (req, res) => {
  const parsedParams = limitedSpinParamsSchema.safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: "ガチャの指定が不正です。" });
  const { key } = parsedParams.data;
  const userId = req.user!.id;

  const banner = await prisma.limitedGacha.findUnique({ where: { key } });
  if (!banner || !banner.active) {
    return res.status(400).json({ error: "このガチャは現在開催されていません。" });
  }

  const now = Date.now();
  const last = lastGachaAt.get(userId) ?? 0;
  const remaining = GACHA_COOLDOWN_SECONDS - (now - last) / 1000;
  if (remaining > 0) {
    return res.status(429).json({ error: `ガチャは連続で引けません。あと${remaining.toFixed(1)}秒待ってください。` });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(401).json({ error: "ログインが必要です。" });
  if (user.money < banner.cost) {
    return res.status(400).json({ error: `コインが足りません。(所持金: ${user.money} / 必要: ${banner.cost})` });
  }

  lastGachaAt.set(userId, now);

  const result = spinLimitedReels();

  const [updatedUser] = await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { money: { decrement: banner.cost } } }),
    prisma.character.create({
      data: {
        userId,
        nationality: result.nationality,
        age: result.age,
        gender: result.gender,
        feature: result.feature,
        rarity: result.rarity,
        secretFeature: result.secretFeature,
        specialType: result.specialType,
        isExclusive: true,
      },
    }),
  ]);

  res.json({ result, money: updatedUser.money });
});

gachaRouter.get("/items-gacha", requireAuth, async (_req, res) => {
  const [config, entries] = await Promise.all([
    prisma.itemGachaConfig.findUnique({ where: { id: "singleton" } }),
    prisma.itemGachaEntry.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  const pool = entries
    .map((e) => ITEMS[e.itemKey])
    .filter((item): item is NonNullable<typeof item> => !!item);
  res.json({
    active: config?.active ?? false,
    cost: config?.cost ?? 300,
    pool,
  });
});

gachaRouter.post("/items-gacha/spin", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const now = Date.now();
  const last = lastGachaAt.get(userId) ?? 0;
  const remaining = GACHA_COOLDOWN_SECONDS - (now - last) / 1000;
  if (remaining > 0) {
    return res.status(429).json({ error: `ガチャは連続で引けません。あと${remaining.toFixed(1)}秒待ってください。` });
  }

  const [config, entries] = await Promise.all([
    prisma.itemGachaConfig.findUnique({ where: { id: "singleton" } }),
    prisma.itemGachaEntry.findMany(),
  ]);
  if (!config || !config.active) {
    return res.status(400).json({ error: "アイテムガチャは現在開催されていません。" });
  }
  type Candidate = { entry: (typeof entries)[number]; item: ItemDef };
  const candidates: Candidate[] = [];
  for (const e of entries) {
    const item = ITEMS[e.itemKey];
    if (item) candidates.push({ entry: e, item });
  }
  if (candidates.length === 0) {
    return res.status(400).json({ error: "アイテムガチャの中身が空です。" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(401).json({ error: "ログインが必要です。" });
  if (user.money < config.cost) {
    return res.status(400).json({ error: `コインが足りません。(所持金: ${user.money} / 必要: ${config.cost})` });
  }

  const totalWeight = candidates.reduce((sum, c) => sum + c.entry.weight, 0);
  let roll = Math.random() * totalWeight;
  let picked = candidates[candidates.length - 1];
  for (const c of candidates) {
    if (roll < c.entry.weight) {
      picked = c;
      break;
    }
    roll -= c.entry.weight;
  }

  lastGachaAt.set(userId, now);

  try {
    const updatedUser = await prisma.$transaction(async (tx) => {
      const userUpdate = await tx.user.updateMany({
        where: { id: userId, money: { gte: config.cost } },
        data: { money: { decrement: config.cost } },
      });
      if (userUpdate.count === 0) throw new Error("ITEM_GACHA_CONFLICT");
      await tx.inventoryItem.upsert({
        where: { userId_itemKey: { userId, itemKey: picked.item.key } },
        create: { userId, itemKey: picked.item.key, quantity: 1 },
        update: { quantity: { increment: 1 } },
      });
      return tx.user.findUniqueOrThrow({ where: { id: userId } });
    });
    res.json({ result: picked.item, money: updatedUser.money });
  } catch (err) {
    if (err instanceof Error && err.message === "ITEM_GACHA_CONFLICT") {
      return res.status(409).json({ error: "他の操作と競合しました。もう一度お試しください。" });
    }
    throw err;
  }
});
