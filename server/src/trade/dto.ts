import { ITEMS } from "@identity-slot/game-core";
import { prisma } from "../lib/prisma";
import { TradeOffer, TradeRoom } from "./types";

export async function roomToStateDTO(room: TradeRoom) {
  const [p1, p2] = room.userIds;
  const allCharacterIds = [...room.offers[p1].characterIds, ...room.offers[p2].characterIds];
  const characters = allCharacterIds.length
    ? await prisma.character.findMany({ where: { id: { in: allCharacterIds } } })
    : [];
  const characterById = new Map(characters.map((c) => [c.id, c]));

  function resolveOffer(offer: TradeOffer) {
    return {
      characters: offer.characterIds.map((id) => characterById.get(id)).filter((c) => !!c),
      items: offer.items.map((i) => ({ itemKey: i.itemKey, quantity: i.quantity, item: ITEMS[i.itemKey] ?? null })),
      coins: offer.coins,
      confirmed: offer.confirmed,
    };
  }

  return {
    roomId: room.id,
    userIds: room.userIds,
    displayNames: room.displayNames,
    offers: {
      [p1]: resolveOffer(room.offers[p1]),
      [p2]: resolveOffer(room.offers[p2]),
    },
  };
}

export type TradeStateDTO = Awaited<ReturnType<typeof roomToStateDTO>>;
