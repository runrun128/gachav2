"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const game_core_1 = require("@identity-slot/game-core");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
exports.adminRouter = (0, express_1.Router)();
exports.adminRouter.use(auth_1.requireAuth, auth_1.requireAdmin);
exports.adminRouter.get("/items", (_req, res) => {
    res.json({ items: Object.values(game_core_1.ITEMS) });
});
const searchSchema = zod_1.z.object({ q: zod_1.z.string().optional() });
exports.adminRouter.get("/users", async (req, res) => {
    const parsed = searchSchema.safeParse(req.query);
    const q = parsed.success ? parsed.data.q?.trim() : undefined;
    const users = await prisma_1.prisma.user.findMany({
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
const giveMoneySchema = zod_1.z.object({
    userId: zod_1.z.string().min(1),
    amount: zod_1.z.coerce.number().int().min(1).max(1_000_000_000),
});
exports.adminRouter.post("/give-money", async (req, res) => {
    const parsed = giveMoneySchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: "入力内容が不正です。" });
    const { userId, amount } = parsed.data;
    const target = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!target)
        return res.status(404).json({ error: "対象のユーザーが見つかりません。" });
    const updated = await prisma_1.prisma.user.update({ where: { id: userId }, data: { money: { increment: amount } } });
    res.json({ id: updated.id, displayName: updated.displayName, money: updated.money });
});
const giveItemSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1),
    itemKey: zod_1.z.string().min(1),
    amount: zod_1.z.coerce.number().int().min(1).max(1_000_000),
});
exports.adminRouter.post("/give-item", async (req, res) => {
    const parsed = giveItemSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: "入力内容が不正です。" });
    const { userId, itemKey, amount } = parsed.data;
    if (!game_core_1.ITEMS[itemKey])
        return res.status(400).json({ error: "存在しないアイテムです。" });
    const target = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!target)
        return res.status(404).json({ error: "対象のユーザーが見つかりません。" });
    const item = await prisma_1.prisma.inventoryItem.upsert({
        where: { userId_itemKey: { userId, itemKey } },
        create: { userId, itemKey, quantity: amount },
        update: { quantity: { increment: amount } },
    });
    res.json({ userId, itemKey, quantity: item.quantity });
});
const broadcastItemSchema = zod_1.z.object({
    itemKey: zod_1.z.string().min(1),
    amount: zod_1.z.coerce.number().int().min(1).max(1_000_000),
});
exports.adminRouter.post("/broadcast-item", async (req, res) => {
    const parsed = broadcastItemSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: "入力内容が不正です。" });
    const { itemKey, amount } = parsed.data;
    if (!game_core_1.ITEMS[itemKey])
        return res.status(400).json({ error: "存在しないアイテムです。" });
    const users = await prisma_1.prisma.user.findMany({ select: { id: true } });
    await prisma_1.prisma.$transaction(users.map((u) => prisma_1.prisma.inventoryItem.upsert({
        where: { userId_itemKey: { userId: u.id, itemKey } },
        create: { userId: u.id, itemKey, quantity: amount },
        update: { quantity: { increment: amount } },
    })));
    res.json({ recipientCount: users.length });
});
