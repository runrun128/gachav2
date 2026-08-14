import { NextFunction, Request, Response } from "express";
import { env } from "../lib/env";
import { verifyToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: "user" | "admin" };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[env.cookieName];
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return res.status(401).json({ error: "ログインが必要です。" });
  }
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    return res.status(401).json({ error: "ログインが必要です。" });
  }
  req.user = { id: user.id, role: user.role as "user" | "admin" };
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "管理者権限が必要です。" });
  }
  next();
}
