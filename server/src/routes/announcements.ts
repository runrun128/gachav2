import { Router } from "express";
import { z } from "zod";
import { ITEMS, SPECIAL_TYPE_ORDER } from "@identity-slot/game-core";
import { prisma } from "../lib/prisma";
import { sendPushToUsers } from "../lib/push";
import { requireAdmin, requireAuth } from "../middleware/auth";

export const announcementsRouter = Router();

// 全員宛の告知 + 自分宛の個人メッセージ(運営からの個別のお礼・報告等)の両方をまとめて返す
announcementsRouter.get("/announcements", requireAuth, async (req, res) => {
  const items = await prisma.announcement.findMany({
    where: { OR: [{ recipientUserId: null }, { recipientUserId: req.user!.id }] },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { author: { select: { displayName: true } }, grantedCharacter: true },
  });

  res.json({
    items: items.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      authorDisplayName: a.author.displayName,
      isPersonal: a.recipientUserId !== null,
      coinAmount: a.coinAmount,
      itemKey: a.itemKey,
      itemAmount: a.itemAmount,
      itemName: a.itemKey ? (ITEMS[a.itemKey]?.name ?? a.itemKey) : null,
      itemEmoji: a.itemKey ? (ITEMS[a.itemKey]?.emoji ?? "🎁") : null,
      grantedCharacter: a.grantedCharacter,
      createdAt: a.createdAt,
    })),
  });
});

announcementsRouter.get("/announcements/unread-count", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { lastAnnouncementReadAt: true } });
  if (!user) return res.status(401).json({ error: "ログインが必要です。" });

  const count = await prisma.announcement.count({
    where: {
      OR: [{ recipientUserId: null }, { recipientUserId: req.user!.id }],
      ...(user.lastAnnouncementReadAt ? { createdAt: { gt: user.lastAnnouncementReadAt } } : {}),
    },
  });

  res.json({ count });
});

announcementsRouter.post("/announcements/mark-read", requireAuth, async (req, res) => {
  await prisma.user.update({ where: { id: req.user!.id }, data: { lastAnnouncementReadAt: new Date() } });
  res.status(204).end();
});

const createSchema = z
  .object({
    title: z.string().min(1).max(60),
    body: z.string().min(1).max(2000),
    recipientUserId: z.string().min(1).optional(),
    coinAmount: z.coerce.number().int().min(1).max(1_000_000_000).optional(),
    itemKey: z.string().min(1).optional(),
    itemAmount: z.coerce.number().int().min(1).max(1_000_000).optional(),
    character: z
      .object({
        nationality: z.string().min(1).max(30),
        age: z.coerce.number().int().min(0).max(999),
        gender: z.string().min(1).max(20),
        feature: z.string().min(1).max(40),
        secretFeature: z.string().min(1).max(60),
        specialType: z.enum(SPECIAL_TYPE_ORDER as [string, ...string[]]),
      })
      .optional(),
  })
  .refine((v) => !v.character || v.recipientUserId, {
    message: "キャラクターを添えるには宛先を特定のユーザーに指定してください。",
  });

announcementsRouter.post("/admin/announcements", requireAuth, requireAdmin, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "入力内容が不正です。" });
  }
  const { title, body, recipientUserId, coinAmount, itemKey, itemAmount, character } = parsed.data;

  if (itemKey && !ITEMS[itemKey]) {
    return res.status(400).json({ error: "存在しないアイテムです。" });
  }
  if (itemKey && !itemAmount) {
    return res.status(400).json({ error: "アイテムを付ける場合は個数を指定してください。" });
  }

  let recipients: { id: string }[];
  if (recipientUserId) {
    const target = await prisma.user.findUnique({ where: { id: recipientUserId }, select: { id: true } });
    if (!target) return res.status(404).json({ error: "対象のユーザーが見つかりません。" });
    recipients = [target];
  } else {
    recipients = await prisma.user.findMany({ select: { id: true } });
  }

  let grantedCharacterId: string | null = null;
  if (character && recipientUserId) {
    const createdCharacter = await prisma.character.create({
      data: { userId: recipientUserId, ...character, rarity: "KMR", isExclusive: true },
    });
    grantedCharacterId = createdCharacter.id;
  }

  const announcement = await prisma.announcement.create({
    data: {
      title,
      body,
      authorId: req.user!.id,
      recipientUserId: recipientUserId ?? null,
      coinAmount: coinAmount ?? null,
      itemKey: itemKey ?? null,
      itemAmount: itemKey ? (itemAmount ?? null) : null,
      grantedCharacterId,
    },
  });

  if (coinAmount || itemKey) {
    const updates: Promise<unknown>[] = [];
    for (const u of recipients) {
      if (coinAmount) {
        updates.push(prisma.user.update({ where: { id: u.id }, data: { money: { increment: coinAmount } } }));
      }
      if (itemKey && itemAmount) {
        updates.push(
          prisma.inventoryItem.upsert({
            where: { userId_itemKey: { userId: u.id, itemKey } },
            create: { userId: u.id, itemKey, quantity: itemAmount },
            update: { quantity: { increment: itemAmount } },
          })
        );
      }
    }
    await Promise.all(updates);
  }

  sendPushToUsers(
    recipients.map((r) => r.id),
    { title: `📢 ${title}`, body, url: "/announcements", tag: "announcement" }
  ).catch((err) => console.error("[push] announcement notify failed", err));

  res.status(201).json({ id: announcement.id, recipientCount: recipients.length });
});

// 運営パネル用: 個人宛も含めて全件を新しい順に一覧表示する(削除対象を探すため)
announcementsRouter.get("/admin/announcements", requireAuth, requireAdmin, async (_req, res) => {
  const items = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { author: { select: { displayName: true } }, recipient: { select: { displayName: true } } },
  });

  res.json({
    items: items.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      authorDisplayName: a.author.displayName,
      recipientDisplayName: a.recipient?.displayName ?? null,
      coinAmount: a.coinAmount,
      itemKey: a.itemKey,
      itemAmount: a.itemAmount,
      createdAt: a.createdAt,
    })),
  });
});

// 誤って送信した告知(表示崩れ等)を取り消す。既に配布済みのコイン/アイテムは回収しない。
announcementsRouter.delete("/admin/announcements/:id", requireAuth, requireAdmin, async (req, res) => {
  const existing = await prisma.announcement.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "そのお知らせが見つかりません。" });

  await prisma.announcement.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
