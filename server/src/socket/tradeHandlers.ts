import { Server as IOServer, Socket } from "socket.io";
import { TradeManager, UpdateOfferInput, UserFacingError } from "../trade/manager";

type AckResponse = { ok: true; data?: unknown } | { ok: false; error: string };
type Ack = (response: AckResponse) => void;

function wrap(fn: () => Promise<unknown> | unknown, ack?: Ack) {
  Promise.resolve()
    .then(fn)
    .then((data) => ack?.({ ok: true, data }))
    .catch((err) => {
      const message = err instanceof UserFacingError ? err.message : "エラーが発生しました。";
      if (!(err instanceof UserFacingError)) console.error("[trade handler]", err);
      ack?.({ ok: false, error: message });
    });
}

export function registerTradeHandlers(_io: IOServer, socket: Socket, manager: TradeManager, userId: string) {
  socket.on("trade:invite", (payload: { targetUserId: string }, ack?: Ack) =>
    wrap(() => manager.createInvite(userId, payload.targetUserId), ack)
  );

  socket.on("trade:respondInvite", (payload: { inviteId: string; accept: boolean }, ack?: Ack) =>
    wrap(() => manager.respondInvite(payload.inviteId, userId, payload.accept), ack)
  );

  socket.on("trade:joinRoom", (payload: { roomId: string }, ack?: Ack) =>
    wrap(() => manager.joinRoom(payload.roomId, userId), ack)
  );

  socket.on("trade:myRoom", (_payload: unknown, ack?: Ack) =>
    wrap(() => ({ roomId: manager.getRoomForUser(userId)?.id ?? null }), ack)
  );

  socket.on("trade:updateOffer", (payload: { roomId: string } & UpdateOfferInput, ack?: Ack) =>
    wrap(
      () =>
        manager.updateOffer(payload.roomId, userId, {
          characterIds: payload.characterIds,
          items: payload.items,
          coins: payload.coins,
        }),
      ack
    )
  );

  socket.on("trade:confirm", (payload: { roomId: string }, ack?: Ack) =>
    wrap(() => manager.confirm(payload.roomId, userId), ack)
  );

  socket.on("trade:cancel", (payload: { roomId: string }, ack?: Ack) =>
    wrap(() => manager.cancel(payload.roomId, userId), ack)
  );
}
