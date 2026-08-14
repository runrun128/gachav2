import { Router } from "express";
import { z } from "zod";
import { getVapidPublicKey, isPushEnabled } from "../lib/push";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const pushRouter = Router();

pushRouter.get("/push/public-key", (_req, res) => {
  res.json({ enabled: isPushEnabled(), publicKey: getVapidPublicKey() });
});

const subscribeSchema = z.object({
  endpoint: z.string().min(1),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

pushRouter.post("/push/subscribe", requireAuth, async (req, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "購読情報が不正です。" });

  const { endpoint, keys } = parsed.data;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: req.user!.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId: req.user!.id, p256dh: keys.p256dh, auth: keys.auth },
  });
  res.status(204).end();
});

const unsubscribeSchema = z.object({ endpoint: z.string().min(1) });

pushRouter.post("/push/unsubscribe", requireAuth, async (req, res) => {
  const parsed = unsubscribeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "endpointが必要です。" });

  await prisma.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint, userId: req.user!.id } });
  res.status(204).end();
});
