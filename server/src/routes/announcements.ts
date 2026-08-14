import { Router } from "express";
import { z } from "zod";
import { ITEMS } from "@identity-slot/game-core";
import { prisma } from "../lib/prisma";
import { requireAdmin, requireAuth } from "../middleware/auth";

export const announcementsRouter = Router();

announcementsRouter.get("/announcements", requireAuth, async (_req, res) => {
  const items = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { author: { select: { displayName: true } } },
  });

  res.json({
    items: items.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      authorDisplayName: a.author.displayName,
      coinAmount: a.coinAmount,
      itemKey: a.itemKey,
      itemAmount: a.itemAmount,
      itemName: a.itemKey ? (ITEMS[a.itemKey]?.name ?? a.itemKey) : null,
      itemEmoji: a.itemKey ? (ITEMS[a.itemKey]?.emoji ?? "🎁") : null,
      createdAt: a.createdAt,
    })),
  });
});

const createSchema = z.object({
  title: z.string().min(1).max(60),
  body: z.string().min(1).max(2000),
  coinAmount: z.coerce.number().int().min(1).max(1_000_000_000).optional(),
  itemKey: z.string().min(1).optional(),
  itemAmount: z.coerce.number().int().min(1).max(1_000_000).optional(),
});

announcementsRouter.post("/admin/announcements", requireAuth, requireAdmin, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "入力内容が不正です。" });
  }
  const { title, body, coinAmount, itemKey, itemAmount } = parsed.data;

  if (itemKey && !ITEMS[itemKey]) {
    return res.status(400).json({ error: "存在しないアイテムです。" });
  }
  if (itemKey && !itemAmount) {
    return res.status(400).json({ error: "アイテムを付ける場合は個数を指定してください。" });
  }

  const announcement = await prisma.announcement.create({
    data: {
      title,
      body,
      authorId: req.user!.id,
      coinAmount: coinAmount ?? null,
      itemKey: itemKey ?? null,
      itemAmount: itemKey ? (itemAmount ?? null) : null,
    },
  });

  let recipientCount = 0;
  if (coinAmount || itemKey) {
    const users = await prisma.user.findMany({ select: { id: true } });
    recipientCount = users.length;
    const updates: Promise<unknown>[] = [];
    for (const u of users) {
      if (coinAmount) {
        updates.push(prisma.user.update({ where: { id: u.id }, data: { money: { increment: coinAmount } } }));
      }
      if (itemKey && itemAmount) {
        updates.push(
          prisma.inventoryItem.upsert({
            where: { userId_itemKey: { userId: u.id, itemKey } },
            create: { userId: u.id, itemKey, quantity: itemAmount },
            update: { quantity: { increment: itemAmount } },
          })
        );
      }
    }
    await Promise.all(updates);
  }

  res.status(201).json({ id: announcement.id, recipientCount });
});
