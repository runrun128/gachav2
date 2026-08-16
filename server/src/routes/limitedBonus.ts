import { Router } from "express";
import { ITEMS } from "@identity-slot/game-core";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const limitedBonusRouter = Router();

limitedBonusRouter.get("/limited-bonuses", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const now = new Date();

  const active = await prisma.limitedBonus.findMany({
    where: { startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { endsAt: "asc" },
  });
  const claimed = new Set(
    (
      await prisma.limitedBonusClaim.findMany({
        where: { userId, limitedBonusId: { in: active.map((b) => b.id) } },
        select: { limitedBonusId: true },
      })
    ).map((c) => c.limitedBonusId)
  );

  res.json({
    bonuses: active.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      endsAt: b.endsAt,
      coinAmount: b.coinAmount,
      itemKey: b.itemKey,
      itemAmount: b.itemAmount,
      item: b.itemKey ? ITEMS[b.itemKey] ?? null : null,
      claimed: claimed.has(b.id),
    })),
  });
});

limitedBonusRouter.post("/limited-bonuses/:id/claim", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const now = new Date();

  const bonus = await prisma.limitedBonus.findUnique({ where: { id: req.params.id } });
  if (!bonus) return res.status(404).json({ error: "そのボーナスが見つかりません。" });
  if (bonus.startsAt > now || bonus.endsAt < now) {
    return res.status(400).json({ error: "現在受け取れる期間ではありません。" });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // ユニーク制約(userId, limitedBonusId)により、同時に複数リクエストが飛んでも
      // 二重受け取りは発生しない(2件目はP2002で失敗しロールバックされる)。
      await tx.limitedBonusClaim.create({ data: { userId, limitedBonusId: bonus.id } });

      if (bonus.coinAmount) {
        await tx.user.update({ where: { id: userId }, data: { money: { increment: bonus.coinAmount } } });
      }
      if (bonus.itemKey && bonus.itemAmount) {
        await tx.inventoryItem.upsert({
          where: { userId_itemKey: { userId, itemKey: bonus.itemKey } },
          create: { userId, itemKey: bonus.itemKey, quantity: bonus.itemAmount },
          update: { quantity: { increment: bonus.itemAmount } },
        });
      }
    });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return res.status(409).json({ error: "すでに受け取り済みです。" });
    }
    throw err;
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  res.json({
    money: user.money,
    coinAmount: bonus.coinAmount,
    itemKey: bonus.itemKey,
    itemAmount: bonus.itemAmount,
  });
});
