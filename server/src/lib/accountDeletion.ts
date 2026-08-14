import { getBattleManager, getRaidManager } from "../socket";
import { prisma } from "./prisma";

/** アカウント削除前に、進行中のバトル/レイドがあれば離脱させておく(ベストエフォート)。 */
async function leaveActiveGames(userId: string) {
  try {
    const battleManager = getBattleManager();
    const room = battleManager?.getRoomForUser(userId);
    if (room) await battleManager!.retire(room.id, userId);
  } catch (err) {
    console.error("[accountDeletion] failed to retire from battle", err);
  }

  try {
    const raidManager = getRaidManager();
    const roomId = raidManager?.getActiveRoomId(userId);
    if (roomId) await raidManager!.leaveRaid(roomId, userId);
  } catch (err) {
    console.error("[accountDeletion] failed to leave raid", err);
  }
}

/** ユーザーとその所持データ(キャラ/アイテム/お知らせ等)を完全に削除する。 */
export async function deleteUserAccount(userId: string) {
  await leaveActiveGames(userId);
  await prisma.user.delete({ where: { id: userId } });
}
