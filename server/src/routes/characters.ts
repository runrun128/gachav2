import { Router } from "express";
import { z } from "zod";
import {
  MAX_TRAIN_LEVEL,
  SETSPECIAL_COST,
  SPECIAL_TYPE_ORDER,
  isSecretFeatureRarity,
  trainCost,
} from "@identity-slot/game-core";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const charactersRouter = Router();

charactersRouter.post("/characters/:id/train", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const character = await prisma.character.findFirst({ where: { id: req.params.id, userId } });
  if (!character) return res.status(404).json({ error: "キャラクターが見つかりません。" });

  if (character.level >= MAX_TRAIN_LEVEL) {
    return res.status(400).json({ error: `すでに最大レベル(Lv${MAX_TRAIN_LEVEL})です。` });
  }

  const cost = trainCost(character.level);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(401).json({ error: "ログインが必要です。" });
  if (user.money < cost) {
    return res.status(400).json({ error: `コインが足りません。(所持金: ${user.money} / 必要: ${cost})` });
  }

  const [, updatedCharacter] = await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { money: { decrement: cost } } }),
    prisma.character.update({ where: { id: character.id }, data: { level: { increment: 1 } } }),
  ]);

  const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
  res.json({ character: updatedCharacter, money: updatedUser!.money });
});

const setSpecialSchema = z.object({
  specialType: z.enum(SPECIAL_TYPE_ORDER as [string, ...string[]]),
});

charactersRouter.post("/characters/:id/special", requireAuth, async (req, res) => {
  const parsed = setSpecialSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "とくぎ属性が不正です。" });

  const userId = req.user!.id;
  const character = await prisma.character.findFirst({ where: { id: req.params.id, userId } });
  if (!character) return res.status(404).json({ error: "キャラクターが見つかりません。" });
  if (!isSecretFeatureRarity(character.rarity as any)) {
    return res.status(400).json({ error: "SSR以上のキャラクターのみ、とくぎ属性を変更できます。" });
  }
  if (character.specialType === parsed.data.specialType) {
    return res.status(400).json({ error: "すでにその属性です。" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(401).json({ error: "ログインが必要です。" });
  if (user.money < SETSPECIAL_COST) {
    return res
      .status(400)
      .json({ error: `コインが足りません。(所持金: ${user.money} / 必要: ${SETSPECIAL_COST})` });
  }

  const [, updatedCharacter] = await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { money: { decrement: SETSPECIAL_COST } } }),
    prisma.character.update({ where: { id: character.id }, data: { specialType: parsed.data.specialType } }),
  ]);

  const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
  res.json({ character: updatedCharacter, money: updatedUser!.money });
});
