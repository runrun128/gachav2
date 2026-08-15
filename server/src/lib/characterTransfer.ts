import { Character, Prisma } from "@prisma/client";

export class CharacterUnavailableError extends Error {}

/**
 * キャラクターの所有権移転(トレード成立・マーケット購入で共通利用)。
 * 元の持ち主の行を物理削除/userId書き換えせずsoldAtを立てて手放し扱いにし、
 * 受け取り側には新しい行を作る。生涯実績(総ガチャ回数・最高レアリティ・履歴)は
 * soldAtで絞り込まずに算出するため、渡した側の記録は消えず、受け取った側にも
 * 「入手した」実績として反映される。
 *
 * soldAt: null を条件にした updateMany + 件数チェックで確保してから複製する。
 * 同じキャラクターが複数のトレード/出品に同時に絡んでも、後から確保しようとした
 * 側は0件更新で検知できる(先着した側のコミットにより行ロックされるため)。
 */
export async function transferCharacterOwnership(
  tx: Prisma.TransactionClient,
  characterId: string,
  fromUserId: string,
  toUserId: string
): Promise<Character> {
  const claimed = await tx.character.updateMany({
    where: { id: characterId, userId: fromUserId, soldAt: null },
    data: { soldAt: new Date() },
  });
  if (claimed.count === 0) throw new CharacterUnavailableError("キャラクターはすでに取引されています。");

  const character = await tx.character.findUniqueOrThrow({ where: { id: characterId } });
  return tx.character.create({
    data: {
      userId: toUserId,
      nationality: character.nationality,
      age: character.age,
      gender: character.gender,
      feature: character.feature,
      rarity: character.rarity,
      secretFeature: character.secretFeature,
      specialType: character.specialType,
      level: character.level,
      isExclusive: false,
    },
  });
}
