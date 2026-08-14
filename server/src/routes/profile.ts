import { Router } from "express";
import { z } from "zod";
import { RARITY_ORDER, Rarity, rarityIndex } from "@identity-slot/game-core";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const profileRouter = Router();

async function computeRaritySummary(userId: string) {
  const grouped = await prisma.character.groupBy({
    by: ["rarity"],
    where: { userId },
    _count: { _all: true },
  });

  const rarityCounts: Record<Rarity, number> = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0, MUR: 0 };
  let totalSpins = 0;
  let bestRarity: Rarity = "N";

  for (const g of grouped) {
    const rarity = g.rarity as Rarity;
    rarityCounts[rarity] = g._count._all;
    totalSpins += g._count._all;
    if (rarityIndex(rarity) > rarityIndex(bestRarity)) bestRarity = rarity;
  }

  return { rarityCounts, totalSpins, bestRarity };
}

profileRouter.get("/profile", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(401).json({ error: "ログインが必要です。" });

  const summary = await computeRaritySummary(user.id);

  res.json({
    id: user.id,
    displayName: user.displayName,
    money: user.money,
    role: user.role,
    ...summary,
  });
});

const historyQuerySchema = z.object({
  rarity: z.enum(["N", "R", "SR", "SSR", "UR", "MUR"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

profileRouter.get("/history", requireAuth, async (req, res) => {
  const parsed = historyQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "クエリパラメータが不正です。" });
  const { rarity, page, pageSize } = parsed.data;

  const where = { userId: req.user!.id, ...(rarity ? { rarity } : {}) };

  const [items, total] = await Promise.all([
    prisma.character.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.character.count({ where }),
  ]);

  res.json({ items, total, page, pageSize });
});

profileRouter.get("/ranking", requireAuth, async (_req, res) => {
  const users = await prisma.user.findMany({ select: { id: true, displayName: true } });
  const grouped = await prisma.character.groupBy({ by: ["userId", "rarity"], _count: { _all: true } });

  const perUser = new Map<string, { totalSpins: number; bestRarity: Rarity }>();
  for (const u of users) perUser.set(u.id, { totalSpins: 0, bestRarity: "N" });

  for (const g of grouped) {
    const entry = perUser.get(g.userId);
    if (!entry) continue;
    entry.totalSpins += g._count._all;
    const rarity = g.rarity as Rarity;
    if (rarityIndex(rarity) > rarityIndex(entry.bestRarity)) entry.bestRarity = rarity;
  }

  const ranking = users
    .map((u) => ({ id: u.id, displayName: u.displayName, ...perUser.get(u.id)! }))
    .sort((a, b) => rarityIndex(b.bestRarity) - rarityIndex(a.bestRarity) || b.totalSpins - a.totalSpins)
    .slice(0, 10);

  res.json({ ranking, rarityOrder: RARITY_ORDER });
});
