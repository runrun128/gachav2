"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addSocket = addSocket;
exports.removeSocket = removeSocket;
exports.isUserOnline = isUserOnline;
const onlineUsers = new Map();
function addSocket(userId, socketId) {
    if (!onlineUsers.has(userId))
        onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socketId);
}
function removeSocket(userId, socketId) {
    const set = onlineUsers.get(userId);
    if (!set)
        return;
    set.delete(socketId);
    if (set.size === 0)
        onlineUsers.delete(userId);
}
function isUserOnline(userId) {
    return onlineUsers.has(userId);
}
