import { Server as IOServer, Socket } from "socket.io";
import { BattleManager, UserFacingError } from "../battle/manager";
import { PendingAction } from "../battle/types";

type AckResponse = { ok: true; data?: unknown } | { ok: false; error: string };
type Ack = (response: AckResponse) => void;

function wrap(fn: () => Promise<unknown> | unknown, ack?: Ack) {
  Promise.resolve()
    .then(fn)
    .then((data) => ack?.({ ok: true, data }))
    .catch((err) => {
      const message = err instanceof UserFacingError ? err.message : "エラーが発生しました。";
      if (!(err instanceof UserFacingError)) console.error("[battle handler]", err);
      ack?.({ ok: false, error: message });
    });
}

export function registerBattleHandlers(_io: IOServer, socket: Socket, manager: BattleManager, userId: string) {
  socket.on("battle:challenge", (payload: { targetUserId: string }, ack?: Ack) =>
    wrap(() => manager.createChallenge(userId, payload.targetUserId), ack)
  );

  socket.on("battle:respondChallenge", (payload: { challengeId: string; accept: boolean }, ack?: Ack) =>
    wrap(() => manager.respondChallenge(payload.challengeId, userId, payload.accept), ack)
  );

  socket.on("battle:joinRoom", (payload: { roomId: string }, ack?: Ack) =>
    wrap(() => manager.joinRoom(payload.roomId, userId), ack)
  );

  socket.on("battle:selectCharacter", (payload: { roomId: string; characterId: string }, ack?: Ack) =>
    wrap(() => manager.selectCharacter(payload.roomId, userId, payload.characterId), ack)
  );

  socket.on("battle:action", (payload: { roomId: string; action: PendingAction }, ack?: Ack) =>
    wrap(() => manager.submitAction(payload.roomId, userId, payload.action), ack)
  );

  socket.on("battle:retire", (payload: { roomId: string }, ack?: Ack) =>
    wrap(() => manager.retire(payload.roomId, userId), ack)
  );
}
