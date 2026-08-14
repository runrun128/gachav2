"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gachaRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const game_core_1 = require("@identity-slot/game-core");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
exports.gachaRouter = (0, express_1.Router)();
// ガチャ連打防止のクールダウン(メモリ上のみ・再起動でリセット。Discord版と同じ方式)
const lastGachaAt = new Map();
const spinSchema = zod_1.z.object({
    type: zod_1.z.enum(["single", "ten", "sr", "ssr"]),
});
exports.gachaRouter.post("/spin", auth_1.requireAuth, async (req, res) => {
    const parsed = spinSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "ガチャの種類が不正です。" });
    }
    const type = parsed.data.type;
    const userId = req.user.id;
    const now = Date.now();
    const last = lastGachaAt.get(userId) ?? 0;
    const remaining = game_core_1.GACHA_COOLDOWN_SECONDS - (now - last) / 1000;
    if (remaining > 0) {
        return res.status(429).json({ error: `ガチャは連続で引けません。あと${remaining.toFixed(1)}秒待ってください。` });
    }
    const cost = (0, game_core_1.costForPullType)(type);
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        return res.status(401).json({ error: "ログインが必要です。" });
    if (user.money < cost) {
        return res.status(400).json({ error: `コインが足りません。(所持金: ${user.money} / 必要: ${cost})` });
    }
    lastGachaAt.set(userId, now);
    const count = type === "ten" ? 10 : 1;
    const minRarity = type === "ten" ? undefined : (0, game_core_1.minRarityForPullType)(type);
    const results = Array.from({ length: count }, () => (0, game_core_1.spinReels)(minRarity));
    const [updatedUser] = await prisma_1.prisma.$transaction([
        prisma_1.prisma.user.update({ where: { id: userId }, data: { money: { decrement: cost } } }),
        ...results.map((r) => prisma_1.prisma.character.create({
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
        })),
    ]);
    res.json({ results, money: updatedUser.money });
});
