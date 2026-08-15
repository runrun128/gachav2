import { Router } from "express";
import { z } from "zod";
import {
  MAX_TRAIN_LEVEL,
  Rarity,
  SETSPECIAL_COST,
  SPECIAL_TYPE_ORDER,
  characterSellPrice,
  isCharacterSellable,
  isSecretFeatureRarity,
  trainCost,
} from "@identity-slot/game-core";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const charactersRouter = Router();

// 育成/とくぎ変更の連打防止(メモリ上のみ・再起動でリセット。ガチャと同じ方式)。
// 同時に複数リクエストが飛んでも下のupdateMany側で二重処理は防げるが、
// それ以前にリクエスト数そのものを絞ってDB接続を使い切らせないための保険。
const TRAIN_COOLDOWN_MS = 300;
const lastTrainAt = new Map<string, number>();

function checkTrainCooldown(userId: string): string | null {
  const now = Date.now();
  const last = lastTrainAt.get(userId) ?? 0;
  const remaining = TRAIN_COOLDOWN_MS - (now - last);
  if (remaining > 0) return `連続で操作できません。あと${(remaining / 1000).toFixed(1)}秒待ってください。`;
  lastTrainAt.set(userId, now);
  return null;
}

// バトル/レイドのキャラクター選択用。/history と違いページングで切り捨てず、
// 所持キャラクター全件を返す(選べるキャラが「直近のものだけ」にならないようにするため)。
charactersRouter.get("/characters/mine", requireAuth, async (req, res) => {
  const characters = await prisma.character.findMany({
    where: { userId: req.user!.id, soldAt: null },
    orderBy: { createdAt: "desc" },
  });
  res.json({ items: characters });
});

charactersRouter.post("/characters/:id/train", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const cooldownError = checkTrainCooldown(userId);
  if (cooldownError) return res.status(429).json({ error: cooldownError });

  const character = await prisma.character.findFirst({ where: { id: req.params.id, userId, soldAt: null } });
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

  // 2つのキャラを交互に連打する等で同じキャラに対するリクエストが競合しても、
  // 「読み取った時点のlevel/moneyのままである」という条件付きのupdateManyにすることで
  // 二重にレベル/課金が進んでしまわないようにする(競合した側は更新件数0件で失敗する)。
  // updateManyは対象0件でもエラーを投げないため、片方だけ成功して不整合にならないよう
  // インタラクティブトランザクション内で件数を確認し、条件を満たさなければ例外を投げてロールバックする。
  try {
    const [updatedCharacter, updatedUser] = await prisma.$transaction(async (tx) => {
      const userUpdate = await tx.user.updateMany({
        where: { id: userId, money: { gte: cost } },
        data: { money: { decrement: cost } },
      });
      const characterUpdate = await tx.character.updateMany({
        where: { id: character.id, userId, level: character.level },
        data: { level: { increment: 1 } },
      });
      if (userUpdate.count === 0 || characterUpdate.count === 0) {
        throw new Error("TRAIN_CONFLICT");
      }
      return Promise.all([
        tx.character.findUniqueOrThrow({ where: { id: character.id } }),
        tx.user.findUniqueOrThrow({ where: { id: userId } }),
      ]);
    });
    res.json({ character: updatedCharacter, money: updatedUser.money });
  } catch (err) {
    if (err instanceof Error && err.message === "TRAIN_CONFLICT") {
      return res.status(409).json({ error: "他の操作と競合しました。もう一度お試しください。" });
    }
    throw err;
  }
});

// 売却は物理削除ではなくsoldAtを立てるだけ(総ガチャ回数・最高レアリティ等の生涯実績は
// soldAtで絞り込まずに算出するため、手放しても過去の記録には影響しない)。
charactersRouter.post("/characters/:id/sell", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const cooldownError = checkTrainCooldown(userId);
  if (cooldownError) return res.status(429).json({ error: cooldownError });

  const character = await prisma.character.findFirst({ where: { id: req.params.id, userId, soldAt: null } });
  if (!character) return res.status(404).json({ error: "キャラクターが見つかりません。" });

  const rarity = character.rarity as Rarity;
  if (!isCharacterSellable(rarity, character.isExclusive)) {
    return res.status(400).json({ error: "このキャラクターは売却できません。" });
  }
  const listed = await prisma.tradeListing.findFirst({ where: { characterId: character.id } });
  if (listed) return res.status(400).json({ error: "マーケットに出品中のキャラクターは売却できません。先に出品を取り消してください。" });

  const price = characterSellPrice(rarity, character.level);

  try {
    const updatedUser = await prisma.$transaction(async (tx) => {
      const characterUpdate = await tx.character.updateMany({
        where: { id: character.id, userId, soldAt: null },
        data: { soldAt: new Date() },
      });
      if (characterUpdate.count === 0) throw new Error("TRAIN_CONFLICT");
      return tx.user.update({ where: { id: userId }, data: { money: { increment: price } } });
    });
    res.json({ money: updatedUser.money, price });
  } catch (err) {
    if (err instanceof Error && err.message === "TRAIN_CONFLICT") {
      return res.status(409).json({ error: "他の操作と競合しました。もう一度お試しください。" });
    }
    throw err;
  }
});

const setSpecialSchema = z.object({
  specialType: z.enum(SPECIAL_TYPE_ORDER as [string, ...string[]]),
});

charactersRouter.post("/characters/:id/special", requireAuth, async (req, res) => {
  const parsed = setSpecialSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "とくぎ属性が不正です。" });

  const userId = req.user!.id;
  const cooldownError = checkTrainCooldown(userId);
  if (cooldownError) return res.status(429).json({ error: cooldownError });

  const character = await prisma.character.findFirst({ where: { id: req.params.id, userId, soldAt: null } });
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

  try {
    const [updatedCharacter, updatedUser] = await prisma.$transaction(async (tx) => {
      const userUpdate = await tx.user.updateMany({
        where: { id: userId, money: { gte: SETSPECIAL_COST } },
        data: { money: { decrement: SETSPECIAL_COST } },
      });
      const characterUpdate = await tx.character.updateMany({
        where: { id: character.id, userId, specialType: character.specialType },
        data: { specialType: parsed.data.specialType },
      });
      if (userUpdate.count === 0 || characterUpdate.count === 0) {
        throw new Error("TRAIN_CONFLICT");
      }
      return Promise.all([
        tx.character.findUniqueOrThrow({ where: { id: character.id } }),
        tx.user.findUniqueOrThrow({ where: { id: userId } }),
      ]);
    });
    res.json({ character: updatedCharacter, money: updatedUser.money });
  } catch (err) {
    if (err instanceof Error && err.message === "TRAIN_CONFLICT") {
      return res.status(409).json({ error: "他の操作と競合しました。もう一度お試しください。" });
    }
    throw err;
  }
});
