import { Router } from "express";
import { z } from "zod";
import { ITEMS } from "@identity-slot/game-core";
import { prisma } from "../lib/prisma";
import { requireAdmin, requireAuth } from "../middleware/auth";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/items", (_req, res) => {
  res.json({ items: Object.values(ITEMS) });
});

const searchSchema = z.object({ q: z.string().optional() });

adminRouter.get("/users", async (req, res) => {
  const parsed = searchSchema.safeParse(req.query);
  const q = parsed.success ? parsed.data.q?.trim() : undefined;

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q } },
            { displayName: { contains: q } },
          ],
        }
      : undefined,
    select: { id: true, email: true, displayName: true, money: true, role: true },
    take: 10,
    orderBy: { createdAt: "desc" },
  });

  res.json({ users });
});

const giveMoneySchema = z.object({
  userId: z.string().min(1),
  amount: z.coerce.number().int().min(1).max(1_000_000_000),
});

adminRouter.post("/give-money", async (req, res) => {
  const parsed = giveMoneySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "入力内容が不正です。" });
  const { userId, amount } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return res.status(404).json({ error: "対象のユーザーが見つかりません。" });

  const updated = await prisma.user.update({ where: { id: userId }, data: { money: { increment: amount } } });
  res.json({ id: updated.id, displayName: updated.displayName, money: updated.money });
});

const giveItemSchema = z.object({
  userId: z.string().min(1),
  itemKey: z.string().min(1),
  amount: z.coerce.number().int().min(1).max(1_000_000),
});

adminRouter.post("/give-item", async (req, res) => {
  const parsed = giveItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "入力内容が不正です。" });
  const { userId, itemKey, amount } = parsed.data;

  if (!ITEMS[itemKey]) return res.status(400).json({ error: "存在しないアイテムです。" });

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return res.status(404).json({ error: "対象のユーザーが見つかりません。" });

  const item = await prisma.inventoryItem.upsert({
    where: { userId_itemKey: { userId, itemKey } },
    create: { userId, itemKey, quantity: amount },
    update: { quantity: { increment: amount } },
  });

  res.json({ userId, itemKey, quantity: item.quantity });
});

const broadcastItemSchema = z.object({
  itemKey: z.string().min(1),
  amount: z.coerce.number().int().min(1).max(1_000_000),
});

adminRouter.post("/broadcast-item", async (req, res) => {
  const parsed = broadcastItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "入力内容が不正です。" });
  const { itemKey, amount } = parsed.data;

  if (!ITEMS[itemKey]) return res.status(400).json({ error: "存在しないアイテムです。" });

  const users = await prisma.user.findMany({ select: { id: true } });

  await prisma.$transaction(
    users.map((u) =>
      prisma.inventoryItem.upsert({
        where: { userId_itemKey: { userId: u.id, itemKey } },
        create: { userId: u.id, itemKey, quantity: amount },
        update: { quantity: { increment: amount } },
      })
    )
  );

  res.json({ recipientCount: users.length });
});
