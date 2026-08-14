import { Router } from "express";
import { z } from "zod";
import { ITEMS } from "@identity-slot/game-core";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const shopRouter = Router();

shopRouter.get("/shop", requireAuth, (_req, res) => {
  // ITEMSは運営が独自アイテムを追加/編集するたびにその場でmutateされるため、
  // 起動時点のスナップショットではなく常に最新の状態から算出する。
  res.json({ items: Object.values(ITEMS).filter((i) => i.purchasable) });
});

shopRouter.get("/inventory", requireAuth, async (req, res) => {
  const owned = await prisma.inventoryItem.findMany({
    where: { userId: req.user!.id, quantity: { gt: 0 } },
  });
  // 終売(削除)されたアイテムは、名前も絵文字もない壊れた表示になってしまうため一覧から除外する。
  // 実際の所持数はDB上に残ったままなので、同キーのアイテムが復活すれば再び見えるようになる。
  res.json({
    items: owned
      .filter((o) => ITEMS[o.itemKey])
      .map((o) => ({ itemKey: o.itemKey, quantity: o.quantity, ...ITEMS[o.itemKey] })),
  });
});

const buySchema = z.object({
  itemKey: z.string(),
  amount: z.coerce.number().int().min(1).max(999).default(1),
});

shopRouter.post("/shop/buy", requireAuth, async (req, res) => {
  const parsed = buySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "入力内容が不正です。" });
  const { itemKey, amount } = parsed.data;

  const item = ITEMS[itemKey];
  if (!item || !item.purchasable || !item.price) {
    return res.status(400).json({ error: "そのアイテムは購入できません。" });
  }

  const totalPrice = item.price * amount;
  const userId = req.user!.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(401).json({ error: "ログインが必要です。" });
  if (user.money < totalPrice) {
    return res.status(400).json({ error: `コインが足りません。(所持金: ${user.money} / 必要: ${totalPrice})` });
  }

  const [updatedUser] = await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { money: { decrement: totalPrice } } }),
    prisma.inventoryItem.upsert({
      where: { userId_itemKey: { userId, itemKey } },
      create: { userId, itemKey, quantity: amount },
      update: { quantity: { increment: amount } },
    }),
  ]);

  res.json({ money: updatedUser.money });
});
