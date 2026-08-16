import { Server as IOServer, Socket } from "socket.io";
import { RoyaleManager, UserFacingError } from "../royale/manager";
import { RoyalePendingAction } from "../royale/types";

type AckResponse = { ok: true; data?: unknown } | { ok: false; error: string };
type Ack = (response: AckResponse) => void;

function wrap(fn: () => Promise<unknown> | unknown, ack?: Ack) {
  Promise.resolve()
    .then(fn)
    .then((data) => ack?.({ ok: true, data }))
    .catch((err) => {
      const message = err instanceof UserFacingError ? err.message : "エラーが発生しました。";
      if (!(err instanceof UserFacingError)) console.error("[royale handler]", err);
      ack?.({ ok: false, error: message });
    });
}

export function registerRoyaleHandlers(_io: IOServer, socket: Socket, manager: RoyaleManager, userId: string) {
  socket.on("royale:listLobbies", (_payload: unknown, ack?: Ack) =>
    wrap(() => ({ lobbies: manager.listLobbies() }), ack)
  );
  socket.on("royale:createLobby", (payload: { roomName: string }, ack?: Ack) =>
    wrap(() => manager.createLobby(userId, payload.roomName), ack)
  );
  socket.on("royale:joinLobby", (payload: { roomId: string }, ack?: Ack) =>
    wrap(() => manager.joinLobby(payload.roomId, userId), ack)
  );
  socket.on("royale:joinRoom", (payload: { roomId: string }, ack?: Ack) =>
    wrap(() => manager.joinRoom(payload.roomId, userId), ack)
  );
  socket.on("royale:myRoom", (_payload: unknown, ack?: Ack) =>
    wrap(() => ({ roomId: manager.getActiveRoomId(userId) }), ack)
  );
  socket.on("royale:start", (payload: { roomId: string }, ack?: Ack) =>
    wrap(() => manager.startRoyale(payload.roomId, userId), ack)
  );
  socket.on("royale:selectCharacter", (payload: { roomId: string; characterId: string }, ack?: Ack) =>
    wrap(() => manager.selectCharacter(payload.roomId, userId, payload.characterId), ack)
  );
  socket.on("royale:action", (payload: { roomId: string; action: RoyalePendingAction }, ack?: Ack) =>
    wrap(() => manager.submitAction(payload.roomId, userId, payload.action), ack)
  );
  socket.on("royale:leave", (payload: { roomId: string }, ack?: Ack) =>
    wrap(() => manager.leaveRoyale(payload.roomId, userId), ack)
  );
  socket.on("royale:chat", (payload: { roomId: string; text: string }, ack?: Ack) =>
    wrap(() => manager.sendChatMessage(payload.roomId, userId, payload.text), ack)
  );
  socket.on("royale:listActive", (_payload: unknown, ack?: Ack) =>
    wrap(() => ({ royales: manager.listActiveRoyales() }), ack)
  );
  socket.on("royale:spectate", (payload: { roomId: string }, ack?: Ack) =>
    wrap(() => manager.spectate(payload.roomId, userId), ack)
  );
  socket.on("royale:unspectate", (payload: { roomId: string }, ack?: Ack) =>
    wrap(() => manager.unspectate(payload.roomId, userId), ack)
  );
}
