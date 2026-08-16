import { Router } from "express";
import { computeDailyBonusStatus, dailyBonusRewardForStreak } from "@identity-slot/game-core";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const dailyBonusRouter = Router();

dailyBonusRouter.get("/daily-bonus", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(401).json({ error: "ログインが必要です。" });

  const status = computeDailyBonusStatus(user.lastDailyBonusAt, user.dailyBonusStreak);
  res.json({
    canClaim: status.canClaim,
    currentStreak: user.dailyBonusStreak,
    nextStreak: status.nextStreak,
    nextReward: dailyBonusRewardForStreak(status.nextStreak),
    lastClaimedAt: user.lastDailyBonusAt,
  });
});

dailyBonusRouter.post("/daily-bonus/claim", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(401).json({ error: "ログインが必要です。" });

  const status = computeDailyBonusStatus(user.lastDailyBonusAt, user.dailyBonusStreak);
  if (!status.canClaim) {
    return res.status(400).json({ error: "本日分はすでに受け取り済みです。" });
  }
  const reward = dailyBonusRewardForStreak(status.nextStreak);

  try {
    const updatedUser = await prisma.$transaction(async (tx) => {
      // 読み取った時点のlastDailyBonusAtのままである場合のみ更新することで、
      // 同時に複数リクエストが飛んでも二重に受け取れないようにする。
      const claimUpdate = await tx.user.updateMany({
        where: { id: userId, lastDailyBonusAt: user.lastDailyBonusAt },
        data: {
          money: { increment: reward },
          lastDailyBonusAt: new Date(),
          dailyBonusStreak: status.nextStreak,
        },
      });
      if (claimUpdate.count === 0) throw new Error("DAILY_BONUS_CONFLICT");
      return tx.user.findUniqueOrThrow({ where: { id: userId } });
    });
    res.json({ money: updatedUser.money, streak: updatedUser.dailyBonusStreak, reward });
  } catch (err) {
    if (err instanceof Error && err.message === "DAILY_BONUS_CONFLICT") {
      return res.status(409).json({ error: "他の操作と競合しました。もう一度お試しください。" });
    }
    throw err;
  }
});
