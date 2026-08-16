import { prisma } from "./lib/prisma";
import { ACHIEVEMENTS } from "./achievements";

export async function unlockAchievement(
  userId: string,
  achievementId: keyof typeof ACHIEVEMENTS
) {
  const achievement = ACHIEVEMENTS[achievementId];

  if (!achievement) {
    return false;
  }

  // すでに解除しているか確認
  const alreadyUnlocked = await prisma.userAchievement.findUnique({
    where: {
      userId_achievementId: {
        userId,
        achievementId,
      },
    },
  });

  // もう持っていたら何もしない
  if (alreadyUnlocked) {
    return false;
  }

  // 実績を解除
  await prisma.userAchievement.create({
    data: {
      userId,
      achievementId,
    },
  });

  return true;
}
