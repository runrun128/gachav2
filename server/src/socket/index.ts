import type { Server as HTTPServer } from "http";
import { Server as IOServer, Socket } from "socket.io";
import { BattleManager } from "../battle/manager";
import { env } from "../lib/env";
import { verifyToken } from "../lib/jwt";
import { RaidManager } from "../raid/manager";
import { registerBattleHandlers } from "./battleHandlers";
import { addSocket, removeSocket } from "./presence";
import { registerRaidHandlers } from "./raidHandlers";

function parseCookies(header?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const value = decodeURIComponent(pair.slice(idx + 1).trim());
    result[key] = value;
  }
  return result;
}

export function createSocketServer(httpServer: HTTPServer) {
  const io = new IOServer(httpServer, {
    cors: { origin: env.webOrigin, credentials: true },
  });

  io.use((socket, next) => {
    const cookies = parseCookies(socket.handshake.headers.cookie);
    const token = cookies[env.cookieName];
    const payload = token ? verifyToken(token) : null;
    if (!payload) return next(new Error("unauthorized"));
    socket.data.userId = payload.userId;
    next();
  });

  const battleManager = new BattleManager(io);
  const raidManager = new RaidManager(io);

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);
    addSocket(userId, socket.id);

    registerBattleHandlers(io, socket, battleManager, userId);
    registerRaidHandlers(io, socket, raidManager, userId);

    socket.on("disconnect", () => {
      removeSocket(userId, socket.id);
      battleManager.handleDisconnect(userId);
      raidManager.handleDisconnect(userId);
    });
  });

  return { io, battleManager, raidManager };
}
