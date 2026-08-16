import { prisma } from "./prisma";
import { ACHIEVEMENTS } from "./achievements";

/**
 * 指定した実績を解除する(すでに解除済みなら何もしない)。
 * 実績を10個解除すると自動的に「実績マスター」も解除される。
 */
export async function unlockAchievement(userId: string, achievementId: string): Promise<boolean> {
  const achievement = ACHIEVEMENTS.find((a) => a.id === achievementId);
  if (!achievement) return false;

  const existing = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId } },
  });
  if (existing) return false;

  await prisma.userAchievement.create({ data: { userId, achievementId } });

  if (achievementId !== "achievement_10") {
    const count = await prisma.userAchievement.count({ where: { userId } });
    if (count >= 10) await unlockAchievement(userId, "achievement_10");
  }

  return true;
}

/** ガチャを引いた直後に呼ぶ。総ガチャ回数・SSR入手数に応じた実績を解除する。 */
export async function checkGachaAchievements(userId: string, rarity: string): Promise<void> {
  const totalSpins = await prisma.character.count({ where: { userId } });
  if (totalSpins >= 1) await unlockAchievement(userId, "first_gacha");
  if (totalSpins >= 10) await unlockAchievement(userId, "gacha_10");
  if (totalSpins >= 100) await unlockAchievement(userId, "gacha_100");

  if (rarity === "SSR") {
    const ssrCount = await prisma.character.count({ where: { userId, rarity: "SSR" } });
    if (ssrCount >= 1) await unlockAchievement(userId, "ssr_1");
    if (ssrCount >= 10) await unlockAchievement(userId, "ssr_10");
  }
}

/** バトルに勝利した直後に呼ぶ。totalWinsは更新後の累計勝利数。 */
export async function checkBattleWinAchievements(userId: string, totalWins: number): Promise<void> {
  if (totalWins >= 1) await unlockAchievement(userId, "battle_1");
  if (totalWins >= 10) await unlockAchievement(userId, "battle_10");
}

/** レイド討伐に成功した直後に呼ぶ。totalClearsは更新後の累計討伐数。 */
export async function checkRaidClearAchievements(userId: string, totalClears: number): Promise<void> {
  if (totalClears >= 1) await unlockAchievement(userId, "raid_1");
  if (totalClears >= 10) await unlockAchievement(userId, "raid_10");
}
