import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { ACHIEVEMENTS } from "../achievements";

export const achievementsRouter = Router();

achievementsRouter.get("/achievements", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const unlocked = await prisma.userAchievement.findMany({
    where: { userId },
    orderBy: { unlockedAt: "desc" },
  });

  const unlockedIds = new Set(
    unlocked.map((achievement) => achievement.achievementId)
  );

  res.json(
    ACHIEVEMENTS.map((achievement) => ({
      ...achievement,
      unlocked: unlockedIds.has(achievement.id),
    }))
  );
});

achievementsRouter.patch(
  "/profile/title",
  requireAuth,
  async (req, res) => {
    const { title } = req.body;

    const achievement = ACHIEVEMENTS.find(
      (achievement) => achievement.title === title
    );

    if (!achievement) {
      return res.status(400).json({
        error: "その称号は存在しません。",
      });
    }

    const unlocked = await prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: {
          userId: req.user!.id,
          achievementId: achievement.id,
        },
      },
    });

    if (!unlocked) {
      return res.status(400).json({
        error: "その称号はまだ持っていません。",
      });
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { selectedTitle: title },
    });

    res.json({ selectedTitle: title });
  }
);
