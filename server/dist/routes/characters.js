"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.charactersRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const game_core_1 = require("@identity-slot/game-core");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
exports.charactersRouter = (0, express_1.Router)();
exports.charactersRouter.post("/characters/:id/train", auth_1.requireAuth, async (req, res) => {
    const userId = req.user.id;
    const character = await prisma_1.prisma.character.findFirst({ where: { id: req.params.id, userId } });
    if (!character)
        return res.status(404).json({ error: "キャラクターが見つかりません。" });
    if (character.level >= game_core_1.MAX_TRAIN_LEVEL) {
        return res.status(400).json({ error: `すでに最大レベル(Lv${game_core_1.MAX_TRAIN_LEVEL})です。` });
    }
    const cost = (0, game_core_1.trainCost)(character.level);
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        return res.status(401).json({ error: "ログインが必要です。" });
    if (user.money < cost) {
        return res.status(400).json({ error: `コインが足りません。(所持金: ${user.money} / 必要: ${cost})` });
    }
    const [, updatedCharacter] = await prisma_1.prisma.$transaction([
        prisma_1.prisma.user.update({ where: { id: userId }, data: { money: { decrement: cost } } }),
        prisma_1.prisma.character.update({ where: { id: character.id }, data: { level: { increment: 1 } } }),
    ]);
    const updatedUser = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    res.json({ character: updatedCharacter, money: updatedUser.money });
});
const setSpecialSchema = zod_1.z.object({
    specialType: zod_1.z.enum(game_core_1.SPECIAL_TYPE_ORDER),
});
exports.charactersRouter.post("/characters/:id/special", auth_1.requireAuth, async (req, res) => {
    const parsed = setSpecialSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: "とくぎ属性が不正です。" });
    const userId = req.user.id;
    const character = await prisma_1.prisma.character.findFirst({ where: { id: req.params.id, userId } });
    if (!character)
        return res.status(404).json({ error: "キャラクターが見つかりません。" });
    if (!(0, game_core_1.isSecretFeatureRarity)(character.rarity)) {
        return res.status(400).json({ error: "SSR以上のキャラクターのみ、とくぎ属性を変更できます。" });
    }
    if (character.specialType === parsed.data.specialType) {
        return res.status(400).json({ error: "すでにその属性です。" });
    }
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        return res.status(401).json({ error: "ログインが必要です。" });
    if (user.money < game_core_1.SETSPECIAL_COST) {
        return res
            .status(400)
            .json({ error: `コインが足りません。(所持金: ${user.money} / 必要: ${game_core_1.SETSPECIAL_COST})` });
    }
    const [, updatedCharacter] = await prisma_1.prisma.$transaction([
        prisma_1.prisma.user.update({ where: { id: userId }, data: { money: { decrement: game_core_1.SETSPECIAL_COST } } }),
        prisma_1.prisma.character.update({ where: { id: character.id }, data: { specialType: parsed.data.specialType } }),
    ]);
    const updatedUser = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    res.json({ character: updatedCharacter, money: updatedUser.money });
});
