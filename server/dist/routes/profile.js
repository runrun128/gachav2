"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const game_core_1 = require("@identity-slot/game-core");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
exports.profileRouter = (0, express_1.Router)();
async function computeRaritySummary(userId) {
    const grouped = await prisma_1.prisma.character.groupBy({
        by: ["rarity"],
        where: { userId },
        _count: { _all: true },
    });
    const rarityCounts = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0, MUR: 0 };
    let totalSpins = 0;
    let bestRarity = "N";
    for (const g of grouped) {
        const rarity = g.rarity;
        rarityCounts[rarity] = g._count._all;
        totalSpins += g._count._all;
        if ((0, game_core_1.rarityIndex)(rarity) > (0, game_core_1.rarityIndex)(bestRarity))
            bestRarity = rarity;
    }
    return { rarityCounts, totalSpins, bestRarity };
}
exports.profileRouter.get("/profile", auth_1.requireAuth, async (req, res) => {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user)
        return res.status(401).json({ error: "ログインが必要です。" });
    const summary = await computeRaritySummary(user.id);
    res.json({
        id: user.id,
        displayName: user.displayName,
        money: user.money,
        role: user.role,
        ...summary,
    });
});
const historyQuerySchema = zod_1.z.object({
    rarity: zod_1.z.enum(["N", "R", "SR", "SSR", "UR", "MUR"]).optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
exports.profileRouter.get("/history", auth_1.requireAuth, async (req, res) => {
    const parsed = historyQuerySchema.safeParse(req.query);
    if (!parsed.success)
        return res.status(400).json({ error: "クエリパラメータが不正です。" });
    const { rarity, page, pageSize } = parsed.data;
    const where = { userId: req.user.id, ...(rarity ? { rarity } : {}) };
    const [items, total] = await Promise.all([
        prisma_1.prisma.character.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma_1.prisma.character.count({ where }),
    ]);
    res.json({ items, total, page, pageSize });
});
exports.profileRouter.get("/ranking", auth_1.requireAuth, async (_req, res) => {
    const users = await prisma_1.prisma.user.findMany({ select: { id: true, displayName: true } });
    const grouped = await prisma_1.prisma.character.groupBy({ by: ["userId", "rarity"], _count: { _all: true } });
    const perUser = new Map();
    for (const u of users)
        perUser.set(u.id, { totalSpins: 0, bestRarity: "N" });
    for (const g of grouped) {
        const entry = perUser.get(g.userId);
        if (!entry)
            continue;
        entry.totalSpins += g._count._all;
        const rarity = g.rarity;
        if ((0, game_core_1.rarityIndex)(rarity) > (0, game_core_1.rarityIndex)(entry.bestRarity))
            entry.bestRarity = rarity;
    }
    const ranking = users
        .map((u) => ({ id: u.id, displayName: u.displayName, ...perUser.get(u.id) }))
        .sort((a, b) => (0, game_core_1.rarityIndex)(b.bestRarity) - (0, game_core_1.rarityIndex)(a.bestRarity) || b.totalSpins - a.totalSpins)
        .slice(0, 10);
    res.json({ ranking, rarityOrder: game_core_1.RARITY_ORDER });
});
