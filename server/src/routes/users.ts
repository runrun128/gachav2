import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { isUserOnline } from "../socket/presence";

export const usersRouter = Router();

const searchSchema = z.object({ q: z.string().min(1) });

usersRouter.get("/users/search", requireAuth, async (req, res) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) return res.json({ users: [] });

  const users = await prisma.user.findMany({
    where: {
      displayName: { contains: parsed.data.q },
      id: { not: req.user!.id },
    },
    select: { id: true, displayName: true },
    take: 10,
  });

  res.json({ users: users.map((u) => ({ ...u, online: isUserOnline(u.id) })) });
});
