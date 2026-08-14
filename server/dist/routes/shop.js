"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shopRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const game_core_1 = require("@identity-slot/game-core");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
exports.shopRouter = (0, express_1.Router)();
exports.shopRouter.get("/shop", auth_1.requireAuth, (_req, res) => {
    res.json({ items: game_core_1.PURCHASABLE_ITEMS });
});
exports.shopRouter.get("/inventory", auth_1.requireAuth, async (req, res) => {
    const owned = await prisma_1.prisma.inventoryItem.findMany({
        where: { userId: req.user.id, quantity: { gt: 0 } },
    });
    res.json({
        items: owned.map((o) => ({ itemKey: o.itemKey, quantity: o.quantity, ...game_core_1.ITEMS[o.itemKey] })),
    });
});
const buySchema = zod_1.z.object({
    itemKey: zod_1.z.string(),
    amount: zod_1.z.coerce.number().int().min(1).max(999).default(1),
});
exports.shopRouter.post("/shop/buy", auth_1.requireAuth, async (req, res) => {
    const parsed = buySchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: "入力内容が不正です。" });
    const { itemKey, amount } = parsed.data;
    const item = game_core_1.ITEMS[itemKey];
    if (!item || !item.purchasable || !item.price) {
        return res.status(400).json({ error: "そのアイテムは購入できません。" });
    }
    const totalPrice = item.price * amount;
    const userId = req.user.id;
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        return res.status(401).json({ error: "ログインが必要です。" });
    if (user.money < totalPrice) {
        return res.status(400).json({ error: `コインが足りません。(所持金: ${user.money} / 必要: ${totalPrice})` });
    }
    const [updatedUser] = await prisma_1.prisma.$transaction([
        prisma_1.prisma.user.update({ where: { id: userId }, data: { money: { decrement: totalPrice } } }),
        prisma_1.prisma.inventoryItem.upsert({
            where: { userId_itemKey: { userId, itemKey } },
            create: { userId, itemKey, quantity: amount },
            update: { quantity: { increment: amount } },
        }),
    ]);
    res.json({ money: updatedUser.money });
});
