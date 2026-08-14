"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
const env_1 = require("../lib/env");
const jwt_1 = require("../lib/jwt");
const prisma_1 = require("../lib/prisma");
async function requireAuth(req, res, next) {
    const token = req.cookies?.[env_1.env.cookieName];
    const payload = token ? (0, jwt_1.verifyToken)(token) : null;
    if (!payload) {
        return res.status(401).json({ error: "ログインが必要です。" });
    }
    const user = await prisma_1.prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
        return res.status(401).json({ error: "ログインが必要です。" });
    }
    req.user = { id: user.id, role: user.role };
    next();
}
function requireAdmin(req, res, next) {
    if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "管理者権限が必要です。" });
    }
    next();
}
