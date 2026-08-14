import { BossKey } from "@identity-slot/game-core";
import { Server as IOServer, Socket } from "socket.io";
import { PendingAction } from "../battle/types";
import { RaidManager, UserFacingError } from "../raid/manager";

type AckResponse = { ok: true; data?: unknown } | { ok: false; error: string };
type Ack = (response: AckResponse) => void;

function wrap(fn: () => Promise<unknown> | unknown, ack?: Ack) {
  Promise.resolve()
    .then(fn)
    .then((data) => ack?.({ ok: true, data }))
    .catch((err) => {
      const message = err instanceof UserFacingError ? err.message : "エラーが発生しました。";
      if (!(err instanceof UserFacingError)) console.error("[raid handler]", err);
      ack?.({ ok: false, error: message });
    });
}

export function registerRaidHandlers(_io: IOServer, socket: Socket, manager: RaidManager, userId: string) {
  socket.on("raid:listLobbies", (_payload: unknown, ack?: Ack) =>
    wrap(() => ({ lobbies: manager.listLobbies() }), ack)
  );

  socket.on("raid:createLobby", (payload: { roomName: string; bossKey: BossKey }, ack?: Ack) =>
    wrap(() => manager.createLobby(userId, payload.roomName, payload.bossKey), ack)
  );

  socket.on("raid:joinLobby", (payload: { roomId: string }, ack?: Ack) =>
    wrap(() => manager.joinLobby(payload.roomId, userId), ack)
  );

  socket.on("raid:joinRoom", (payload: { roomId: string }, ack?: Ack) =>
    wrap(() => manager.joinRoom(payload.roomId, userId), ack)
  );

  socket.on("raid:start", (payload: { roomId: string }, ack?: Ack) =>
    wrap(() => manager.startRaid(payload.roomId, userId), ack)
  );

  socket.on("raid:selectCharacter", (payload: { roomId: string; characterId: string }, ack?: Ack) =>
    wrap(() => manager.selectCharacter(payload.roomId, userId, payload.characterId), ack)
  );

  socket.on("raid:action", (payload: { roomId: string; action: PendingAction }, ack?: Ack) =>
    wrap(() => manager.submitAction(payload.roomId, userId, payload.action), ack)
  );

  socket.on("raid:leave", (payload: { roomId: string }, ack?: Ack) =>
    wrap(() => manager.leaveRaid(payload.roomId, userId), ack)
  );
}
