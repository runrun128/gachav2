"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const presence_1 = require("../socket/presence");
exports.usersRouter = (0, express_1.Router)();
const searchSchema = zod_1.z.object({ q: zod_1.z.string().min(1) });
exports.usersRouter.get("/users/search", auth_1.requireAuth, async (req, res) => {
    const parsed = searchSchema.safeParse(req.query);
    if (!parsed.success)
        return res.json({ users: [] });
    const users = await prisma_1.prisma.user.findMany({
        where: {
            displayName: { contains: parsed.data.q },
            id: { not: req.user.id },
        },
        select: { id: true, displayName: true },
        take: 10,
    });
    res.json({ users: users.map((u) => ({ ...u, online: (0, presence_1.isUserOnline)(u.id) })) });
});
