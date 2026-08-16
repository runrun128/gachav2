import { Router } from "express";
import { z } from "zod";
import { ACHIEVEMENTS } from "../lib/achievements";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const achievementsRouter = Router();

achievementsRouter.get("/achievements", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const unlocked = await prisma.userAchievement.findMany({
    where: { userId },
    orderBy: { unlockedAt: "desc" },
  });
  const unlockedIds = new Set(unlocked.map((a) => a.achievementId));

  res.json({
    items: ACHIEVEMENTS.map((achievement) => ({
      ...achievement,
      unlocked: unlockedIds.has(achievement.id),
    })),
  });
});

const setTitleSchema = z.object({ title: z.string().min(1).nullable() });

achievementsRouter.patch("/profile/title", requireAuth, async (req, res) => {
  const parsed = setTitleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "入力内容が不正です。" });
  const { title } = parsed.data;

  if (title === null) {
    const updated = await prisma.user.update({ where: { id: req.user!.id }, data: { selectedTitle: null } });
    return res.json({ selectedTitle: updated.selectedTitle });
  }

  const achievement = ACHIEVEMENTS.find((a) => a.title === title);
  if (!achievement) return res.status(400).json({ error: "その称号は存在しません。" });

  const unlocked = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId: req.user!.id, achievementId: achievement.id } },
  });
  if (!unlocked) return res.status(400).json({ error: "その称号はまだ持っていません。" });

  const updated = await prisma.user.update({ where: { id: req.user!.id }, data: { selectedTitle: title } });
  res.json({ selectedTitle: updated.selectedTitle });
});
