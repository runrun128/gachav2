"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBattleHandlers = registerBattleHandlers;
const manager_1 = require("../battle/manager");
function wrap(fn, ack) {
    Promise.resolve()
        .then(fn)
        .then((data) => ack?.({ ok: true, data }))
        .catch((err) => {
        const message = err instanceof manager_1.UserFacingError ? err.message : "エラーが発生しました。";
        if (!(err instanceof manager_1.UserFacingError))
            console.error("[battle handler]", err);
        ack?.({ ok: false, error: message });
    });
}
function registerBattleHandlers(_io, socket, manager, userId) {
    socket.on("battle:challenge", (payload, ack) => wrap(() => manager.createChallenge(userId, payload.targetUserId), ack));
    socket.on("battle:respondChallenge", (payload, ack) => wrap(() => manager.respondChallenge(payload.challengeId, userId, payload.accept), ack));
    socket.on("battle:joinRoom", (payload, ack) => wrap(() => manager.joinRoom(payload.roomId, userId), ack));
    socket.on("battle:selectCharacter", (payload, ack) => wrap(() => manager.selectCharacter(payload.roomId, userId, payload.characterId), ack));
    socket.on("battle:action", (payload, ack) => wrap(() => manager.submitAction(payload.roomId, userId, payload.action), ack));
    socket.on("battle:retire", (payload, ack) => wrap(() => manager.retire(payload.roomId, userId), ack));
}
