"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSocketServer = createSocketServer;
const socket_io_1 = require("socket.io");
const manager_1 = require("../battle/manager");
const env_1 = require("../lib/env");
const jwt_1 = require("../lib/jwt");
const manager_2 = require("../raid/manager");
const battleHandlers_1 = require("./battleHandlers");
const presence_1 = require("./presence");
const raidHandlers_1 = require("./raidHandlers");
function parseCookies(header) {
    const result = {};
    if (!header)
        return result;
    for (const pair of header.split(";")) {
        const idx = pair.indexOf("=");
        if (idx === -1)
            continue;
        const key = pair.slice(0, idx).trim();
        const value = decodeURIComponent(pair.slice(idx + 1).trim());
        result[key] = value;
    }
    return result;
}
function createSocketServer(httpServer) {
    const io = new socket_io_1.Server(httpServer, {
        cors: { origin: env_1.env.webOrigin, credentials: true },
    });
    io.use((socket, next) => {
        const cookies = parseCookies(socket.handshake.headers.cookie);
        const token = cookies[env_1.env.cookieName];
        const payload = token ? (0, jwt_1.verifyToken)(token) : null;
        if (!payload)
            return next(new Error("unauthorized"));
        socket.data.userId = payload.userId;
        next();
    });
    const battleManager = new manager_1.BattleManager(io);
    const raidManager = new manager_2.RaidManager(io);
    io.on("connection", (socket) => {
        const userId = socket.data.userId;
        socket.join(`user:${userId}`);
        (0, presence_1.addSocket)(userId, socket.id);
        (0, battleHandlers_1.registerBattleHandlers)(io, socket, battleManager, userId);
        (0, raidHandlers_1.registerRaidHandlers)(io, socket, raidManager, userId);
        socket.on("disconnect", () => {
            (0, presence_1.removeSocket)(userId, socket.id);
            battleManager.handleDisconnect(userId);
            raidManager.handleDisconnect(userId);
        });
    });
    return { io, battleManager, raidManager };
}
