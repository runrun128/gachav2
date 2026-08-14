"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.announcementsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const game_core_1 = require("@identity-slot/game-core");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
exports.announcementsRouter = (0, express_1.Router)();
exports.announcementsRouter.get("/announcements", auth_1.requireAuth, async (_req, res) => {
    const items = await prisma_1.prisma.announcement.findMany({
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
            itemName: a.itemKey ? (game_core_1.ITEMS[a.itemKey]?.name ?? a.itemKey) : null,
            itemEmoji: a.itemKey ? (game_core_1.ITEMS[a.itemKey]?.emoji ?? "🎁") : null,
            createdAt: a.createdAt,
        })),
    });
});
const createSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(60),
    body: zod_1.z.string().min(1).max(2000),
    coinAmount: zod_1.z.coerce.number().int().min(1).max(1_000_000_000).optional(),
    itemKey: zod_1.z.string().min(1).optional(),
    itemAmount: zod_1.z.coerce.number().int().min(1).max(1_000_000).optional(),
});
exports.announcementsRouter.post("/admin/announcements", auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "入力内容が不正です。" });
    }
    const { title, body, coinAmount, itemKey, itemAmount } = parsed.data;
    if (itemKey && !game_core_1.ITEMS[itemKey]) {
        return res.status(400).json({ error: "存在しないアイテムです。" });
    }
    if (itemKey && !itemAmount) {
        return res.status(400).json({ error: "アイテムを付ける場合は個数を指定してください。" });
    }
    const announcement = await prisma_1.prisma.announcement.create({
        data: {
            title,
            body,
            authorId: req.user.id,
            coinAmount: coinAmount ?? null,
            itemKey: itemKey ?? null,
            itemAmount: itemKey ? (itemAmount ?? null) : null,
        },
    });
    let recipientCount = 0;
    if (coinAmount || itemKey) {
        const users = await prisma_1.prisma.user.findMany({ select: { id: true } });
        recipientCount = users.length;
        const updates = [];
        for (const u of users) {
            if (coinAmount) {
                updates.push(prisma_1.prisma.user.update({ where: { id: u.id }, data: { money: { increment: coinAmount } } }));
            }
            if (itemKey && itemAmount) {
                updates.push(prisma_1.prisma.inventoryItem.upsert({
                    where: { userId_itemKey: { userId: u.id, itemKey } },
                    create: { userId: u.id, itemKey, quantity: itemAmount },
                    update: { quantity: { increment: itemAmount } },
                }));
            }
        }
        await Promise.all(updates);
    }
    res.status(201).json({ id: announcement.id, recipientCount });
});
