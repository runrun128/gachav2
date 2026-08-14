import { Router } from "express";
import { z } from "zod";
import { ITEMS, SPECIAL_TYPE_ORDER } from "@identity-slot/game-core";
import { applyCustomFeature, applyCustomItem, removeCustomFeature, removeCustomItem } from "../lib/gameContent";
import { prisma } from "../lib/prisma";
import { requireAdmin, requireAuth } from "../middleware/auth";

const ITEM_EFFECTS = [
  "heal",
  "attack_multiplier",
  "invincible_1",
  "invincible_n",
  "priority_attack",
  "shield_partial_1",
  "enemy_atk_down",
  "poison",
  "nuke_and_full_heal",
  "extra_turn",
] as const;
const ITEM_TIERS = ["shop", "common", "uncommon", "rare", "legendary"] as const;

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/items", (_req, res) => {
  res.json({ items: Object.values(ITEMS) });
});

const searchSchema = z.object({ q: z.string().optional() });

adminRouter.get("/users", async (req, res) => {
  const parsed = searchSchema.safeParse(req.query);
  const q = parsed.success ? parsed.data.q?.trim() : undefined;

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q } },
            { displayName: { contains: q } },
          ],
        }
      : undefined,
    select: { id: true, email: true, displayName: true, money: true, role: true },
    take: 10,
    orderBy: { createdAt: "desc" },
  });

  res.json({ users });
});

const giveMoneySchema = z.object({
  userId: z.string().min(1),
  amount: z.coerce.number().int().min(1).max(1_000_000_000),
});

adminRouter.post("/give-money", async (req, res) => {
  const parsed = giveMoneySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "入力内容が不正です。" });
  const { userId, amount } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return res.status(404).json({ error: "対象のユーザーが見つかりません。" });

  const updated = await prisma.user.update({ where: { id: userId }, data: { money: { increment: amount } } });
  res.json({ id: updated.id, displayName: updated.displayName, money: updated.money });
});

const giveItemSchema = z.object({
  userId: z.string().min(1),
  itemKey: z.string().min(1),
  amount: z.coerce.number().int().min(1).max(1_000_000),
});

adminRouter.post("/give-item", async (req, res) => {
  const parsed = giveItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "入力内容が不正です。" });
  const { userId, itemKey, amount } = parsed.data;

  if (!ITEMS[itemKey]) return res.status(400).json({ error: "存在しないアイテムです。" });

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return res.status(404).json({ error: "対象のユーザーが見つかりません。" });

  const item = await prisma.inventoryItem.upsert({
    where: { userId_itemKey: { userId, itemKey } },
    create: { userId, itemKey, quantity: amount },
    update: { quantity: { increment: amount } },
  });

  res.json({ userId, itemKey, quantity: item.quantity });
});

const broadcastItemSchema = z.object({
  itemKey: z.string().min(1),
  amount: z.coerce.number().int().min(1).max(1_000_000),
});

const giveCharacterSchema = z.object({
  userId: z.string().min(1),
  nationality: z.string().min(1).max(30),
  age: z.coerce.number().int().min(0).max(999),
  gender: z.string().min(1).max(20),
  feature: z.string().min(1).max(40),
  secretFeature: z.string().min(1).max(60),
  specialType: z.enum(SPECIAL_TYPE_ORDER as [string, ...string[]]),
});

// 運営限定キャラクター: ガチャの抽選テーブルには存在せず、運営が任意のユーザーに直接付与することでのみ入手できる。
// 常にKMR(運営限定ランク・最高レアリティ)・isExclusive=trueとして作成する。
adminRouter.post("/give-character", async (req, res) => {
  const parsed = giveCharacterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "入力内容が不正です。" });
  const { userId, ...traits } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return res.status(404).json({ error: "対象のユーザーが見つかりません。" });

  const character = await prisma.character.create({
    data: { userId, ...traits, rarity: "KMR", isExclusive: true },
  });

  res.status(201).json({ character });
});

adminRouter.post("/broadcast-item", async (req, res) => {
  const parsed = broadcastItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "入力内容が不正です。" });
  const { itemKey, amount } = parsed.data;

  if (!ITEMS[itemKey]) return res.status(400).json({ error: "存在しないアイテムです。" });

  const users = await prisma.user.findMany({ select: { id: true } });

  await prisma.$transaction(
    users.map((u) =>
      prisma.inventoryItem.upsert({
        where: { userId_itemKey: { userId: u.id, itemKey } },
        create: { userId: u.id, itemKey, quantity: amount },
        update: { quantity: { increment: amount } },
      })
    )
  );

  res.json({ recipientCount: users.length });
});

adminRouter.get("/limited-gacha", async (_req, res) => {
  const banners = await prisma.limitedGacha.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ banners });
});

const toggleLimitedGachaSchema = z.object({ active: z.boolean() });

adminRouter.patch("/limited-gacha/:key", async (req, res) => {
  const parsed = toggleLimitedGachaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "入力内容が不正です。" });

  const banner = await prisma.limitedGacha.findUnique({ where: { key: req.params.key } });
  if (!banner) return res.status(404).json({ error: "そのガチャが見つかりません。" });

  const updated = await prisma.limitedGacha.update({
    where: { key: req.params.key },
    data: { active: parsed.data.active },
  });
  res.json({ banner: updated });
});

// ===== 独自アイテム =====

adminRouter.get("/custom-items", async (_req, res) => {
  const items = await prisma.customItem.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ items });
});

const createCustomItemSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9_]+$/, "半角英数字とアンダースコアのみ使えます。"),
  name: z.string().min(1).max(30),
  emoji: z.string().min(1).max(10),
  price: z.coerce.number().int().min(1).max(1_000_000).optional(),
  purchasable: z.boolean(),
  tier: z.enum(ITEM_TIERS),
  description: z.string().min(1).max(200),
  effect: z.enum(ITEM_EFFECTS),
  value: z.coerce.number(),
});

adminRouter.post("/custom-items", async (req, res) => {
  const parsed = createCustomItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "入力内容が不正です。" });
  const data = parsed.data;

  if (ITEMS[data.key]) return res.status(400).json({ error: "そのキーはすでに使われています。" });

  const created = await prisma.customItem.create({
    data: { ...data, price: data.purchasable ? data.price ?? null : null },
  });
  applyCustomItem(created);
  res.status(201).json({ item: created });
});

adminRouter.delete("/custom-items/:key", async (req, res) => {
  const key = req.params.key;
  const existing = await prisma.customItem.findUnique({ where: { key } });
  if (!existing) return res.status(404).json({ error: "そのアイテムが見つかりません。" });

  const [heldCount, announcedCount] = await Promise.all([
    prisma.inventoryItem.count({ where: { itemKey: key, quantity: { gt: 0 } } }),
    prisma.announcement.count({ where: { itemKey: key } }),
  ]);
  if (heldCount > 0 || announcedCount > 0) {
    return res.status(400).json({ error: "誰かが所持中、またはお知らせで配布済みのため削除できません。" });
  }

  await prisma.customItem.delete({ where: { key } });
  removeCustomItem(key);
  res.status(204).end();
});

// ===== 独自の趣味(特徴) =====

adminRouter.get("/custom-features", async (_req, res) => {
  const features = await prisma.customFeature.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ features });
});

const createCustomFeatureSchema = z.object({
  label: z.string().min(1).max(20),
  hpBonus: z.coerce.number().int().min(-50).max(50).default(0),
  atkBonus: z.coerce.number().int().min(-50).max(50).default(0),
  defBonus: z.coerce.number().int().min(-50).max(50).default(0),
  spdBonus: z.coerce.number().int().min(-50).max(50).default(0),
  luckBonus: z.coerce.number().int().min(-50).max(50).default(0),
});

adminRouter.post("/custom-features", async (req, res) => {
  const parsed = createCustomFeatureSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "入力内容が不正です。" });

  const existing = await prisma.customFeature.findUnique({ where: { label: parsed.data.label } });
  if (existing) return res.status(400).json({ error: "その趣味はすでに登録されています。" });

  const created = await prisma.customFeature.create({ data: parsed.data });
  applyCustomFeature(created);
  res.status(201).json({ feature: created });
});

adminRouter.delete("/custom-features/:label", async (req, res) => {
  const label = decodeURIComponent(req.params.label);
  const existing = await prisma.customFeature.findUnique({ where: { label } });
  if (!existing) return res.status(404).json({ error: "その趣味が見つかりません。" });

  // 既にこの趣味を持っているキャラクターがいてもfeatureは単なる表示文字列なので、
  // 削除しても既存キャラの表示は壊れない(ステータスボーナスの恩恵が今後なくなるだけ)。
  await prisma.customFeature.delete({ where: { label } });
  removeCustomFeature(label);
  res.status(204).end();
});
