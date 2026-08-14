"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRaidHandlers = registerRaidHandlers;
const manager_1 = require("../raid/manager");
function wrap(fn, ack) {
    Promise.resolve()
        .then(fn)
        .then((data) => ack?.({ ok: true, data }))
        .catch((err) => {
        const message = err instanceof manager_1.UserFacingError ? err.message : "エラーが発生しました。";
        if (!(err instanceof manager_1.UserFacingError))
            console.error("[raid handler]", err);
        ack?.({ ok: false, error: message });
    });
}
function registerRaidHandlers(_io, socket, manager, userId) {
    socket.on("raid:listLobbies", (_payload, ack) => wrap(() => ({ lobbies: manager.listLobbies() }), ack));
    socket.on("raid:createLobby", (payload, ack) => wrap(() => manager.createLobby(userId, payload.roomName, payload.bossKey), ack));
    socket.on("raid:joinLobby", (payload, ack) => wrap(() => manager.joinLobby(payload.roomId, userId), ack));
    socket.on("raid:joinRoom", (payload, ack) => wrap(() => manager.joinRoom(payload.roomId, userId), ack));
    socket.on("raid:start", (payload, ack) => wrap(() => manager.startRaid(payload.roomId, userId), ack));
    socket.on("raid:selectCharacter", (payload, ack) => wrap(() => manager.selectCharacter(payload.roomId, userId, payload.characterId), ack));
    socket.on("raid:action", (payload, ack) => wrap(() => manager.submitAction(payload.roomId, userId, payload.action), ack));
    socket.on("raid:leave", (payload, ack) => wrap(() => manager.leaveRaid(payload.roomId, userId), ack));
}
