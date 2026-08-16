import { Server as IOServer, Socket } from "socket.io";
import { TournamentManager, UserFacingError } from "../tournament/manager";

type AckResponse = { ok: true; data?: unknown } | { ok: false; error: string };
type Ack = (response: AckResponse) => void;

function wrap(fn: () => Promise<unknown> | unknown, ack?: Ack) {
  Promise.resolve()
    .then(fn)
    .then((data) => ack?.({ ok: true, data }))
    .catch((err) => {
      const message = err instanceof UserFacingError ? err.message : "エラーが発生しました。";
      if (!(err instanceof UserFacingError)) console.error("[tournament handler]", err);
      ack?.({ ok: false, error: message });
    });
}

export function registerTournamentHandlers(_io: IOServer, socket: Socket, manager: TournamentManager, userId: string) {
  socket.on("tournament:listLobbies", (_payload: unknown, ack?: Ack) =>
    wrap(() => ({ lobbies: manager.listLobbies() }), ack)
  );
  socket.on("tournament:createLobby", (payload: { roomName: string; bracketSize: number }, ack?: Ack) =>
    wrap(() => manager.createLobby(userId, payload.roomName, payload.bracketSize), ack)
  );
  socket.on("tournament:joinLobby", (payload: { roomId: string }, ack?: Ack) =>
    wrap(() => manager.joinLobby(payload.roomId, userId), ack)
  );
  socket.on("tournament:joinRoom", (payload: { roomId: string }, ack?: Ack) =>
    wrap(() => manager.joinRoom(payload.roomId, userId), ack)
  );
  socket.on("tournament:myRoom", (_payload: unknown, ack?: Ack) =>
    wrap(() => ({ roomId: manager.getActiveRoomId(userId) }), ack)
  );
  socket.on("tournament:start", (payload: { roomId: string }, ack?: Ack) =>
    wrap(() => manager.startTournament(payload.roomId, userId), ack)
  );
  socket.on("tournament:selectCharacter", (payload: { roomId: string; characterId: string }, ack?: Ack) =>
    wrap(() => manager.selectCharacter(payload.roomId, userId, payload.characterId), ack)
  );
  socket.on("tournament:leave", (payload: { roomId: string }, ack?: Ack) =>
    wrap(() => manager.leaveTournament(payload.roomId, userId), ack)
  );
  socket.on("tournament:listActive", (_payload: unknown, ack?: Ack) =>
    wrap(() => ({ tournaments: manager.listActiveTournaments() }), ack)
  );
}
