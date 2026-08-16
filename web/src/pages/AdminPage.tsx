import { ItemDef, SPECIAL_TYPE_ORDER, SPECIAL_TYPES } from "@identity-slot/game-core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CSSProperties, FormEvent, useState } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth-context";

interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  money: number;
  role: string;
}

interface LimitedGachaBanner {
  key: string;
  name: string;
  description: string;
  cost: number;
  active: boolean;
}

interface CustomItemRow {
  key: string;
  name: string;
  emoji: string;
  price: number | null;
  purchasable: boolean;
  tier: string;
  description: string;
  effect: string;
  value: number;
}

interface ShopItemRow extends ItemDef {
  isCustom: boolean;
}

interface ShopItemDraft {
  purchasable: boolean;
  price: string;
  tier: string;
}

interface CustomFeatureRow {
  label: string;
  hpBonus: number;
  atkBonus: number;
  defBonus: number;
  spdBonus: number;
  luckBonus: number;
}

interface ItemGachaConfig {
  cost: number;
  active: boolean;
}

interface ItemGachaEntryRow {
  itemKey: string;
  weight: number;
  item: ItemDef | null;
}

interface AdminAnnouncementRow {
  id: string;
  title: string;
  body: string;
  authorDisplayName: string;
  recipientDisplayName: string | null;
  coinAmount: number | null;
  itemKey: string | null;
  itemAmount: number | null;
  createdAt: string;
}

interface LimitedBonusRow {
  id: string;
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  coinAmount: number | null;
  itemKey: string | null;
  itemAmount: number | null;
  _count: { claims: number };
}

const inputStyle: CSSProperties = {
  background: "var(--bg-panel-raised)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "0.5rem 0.6rem",
  color: "var(--text)",
};

const ITEM_TIER_OPTIONS = ["shop", "common", "uncommon", "rare", "legendary"] as const;
const ITEM_EFFECT_OPTIONS = [
  { value: "heal", label: "回復(自分のHPをvalue割合回復)" },
  { value: "attack_multiplier", label: "攻撃倍率(valueの倍率で攻撃)" },
  { value: "invincible_1", label: "1ラウンド無敵" },
  { value: "invincible_n", label: "valueラウンドの間無敵" },
  { value: "priority_attack", label: "先制攻撃(valueの倍率)" },
  { value: "shield_partial_1", label: "1ラウンド被ダメージ軽減(valueの割合)" },
  { value: "enemy_atk_down", label: "相手の攻撃力低下(valueラウンド)" },
  { value: "poison", label: "毒状態にする(valueラウンド)" },
  { value: "nuke_and_full_heal", label: "大ダメージ(valueの倍率)+全回復" },
  { value: "extra_turn", label: "追加行動" },
] as const;

export function AdminPage() {
  const { user: currentUser } = useAuth();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<AdminUser | null>(null);

  const [moneyAmount, setMoneyAmount] = useState("10000");
  const [itemKey, setItemKey] = useState("");
  const [itemAmount, setItemAmount] = useState("10");
  const [broadcastItemKey, setBroadcastItemKey] = useState("");
  const [broadcastAmount, setBroadcastAmount] = useState("1");

  const [charNationality, setCharNationality] = useState("");
  const [charAge, setCharAge] = useState("20");
  const [charGender, setCharGender] = useState("");
  const [charFeature, setCharFeature] = useState("");
  const [charSecretFeature, setCharSecretFeature] = useState("");
  const [charSpecialType, setCharSpecialType] = useState(SPECIAL_TYPE_ORDER[0]);

  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceBody, setAnnounceBody] = useState("");
  const [announceRecipient, setAnnounceRecipient] = useState<"all" | "selected">("all");
  const [announceCoin, setAnnounceCoin] = useState("");
  const [announceItemKey, setAnnounceItemKey] = useState("");
  const [announceItemAmount, setAnnounceItemAmount] = useState("1");
  const [announceAttachChar, setAnnounceAttachChar] = useState(false);
  const [announceCharNationality, setAnnounceCharNationality] = useState("");
  const [announceCharAge, setAnnounceCharAge] = useState("20");
  const [announceCharGender, setAnnounceCharGender] = useState("");
  const [announceCharFeature, setAnnounceCharFeature] = useState("");
  const [announceCharSecretFeature, setAnnounceCharSecretFeature] = useState("");
  const [announceCharSpecialType, setAnnounceCharSpecialType] = useState(SPECIAL_TYPE_ORDER[0]);

  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: adminAnnouncementsData } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: () => api.get<{ items: AdminAnnouncementRow[] }>("/admin/announcements"),
  });
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<string | null>(null);

  const { data: itemsData } = useQuery({
    queryKey: ["admin-items"],
    queryFn: () => api.get<{ items: ItemDef[] }>("/admin/items"),
  });

  const queryClient = useQueryClient();
  const { data: limitedGachaData } = useQuery({
    queryKey: ["admin-limited-gacha"],
    queryFn: () => api.get<{ banners: LimitedGachaBanner[] }>("/admin/limited-gacha"),
  });
  const [limitedGachaBusy, setLimitedGachaBusy] = useState<string | null>(null);

  const { data: limitedBonusesData } = useQuery({
    queryKey: ["admin-limited-bonuses"],
    queryFn: () => api.get<{ bonuses: LimitedBonusRow[] }>("/admin/limited-bonuses"),
  });
  const [bonusName, setBonusName] = useState("");
  const [bonusDescription, setBonusDescription] = useState("");
  const [bonusStartsAt, setBonusStartsAt] = useState("");
  const [bonusEndsAt, setBonusEndsAt] = useState("");
  const [bonusCoinAmount, setBonusCoinAmount] = useState("");
  const [bonusItemKey, setBonusItemKey] = useState("");
  const [bonusItemAmount, setBonusItemAmount] = useState("1");
  const [limitedBonusBusy, setLimitedBonusBusy] = useState<string | boolean>(false);

  const { data: customItemsData } = useQuery({
    queryKey: ["admin-custom-items"],
    queryFn: () => api.get<{ items: CustomItemRow[] }>("/admin/custom-items"),
  });
  const [newItemKey, setNewItemKey] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemEmoji, setNewItemEmoji] = useState("");
  const [newItemTier, setNewItemTier] = useState<(typeof ITEM_TIER_OPTIONS)[number]>("common");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemEffect, setNewItemEffect] = useState<(typeof ITEM_EFFECT_OPTIONS)[number]["value"]>("heal");
  const [newItemValue, setNewItemValue] = useState("0.3");
  const [customItemBusy, setCustomItemBusy] = useState(false);

  const { data: shopItemsData } = useQuery({
    queryKey: ["admin-shop-items"],
    queryFn: () => api.get<{ items: ShopItemRow[] }>("/admin/shop-items"),
  });
  const [shopDrafts, setShopDrafts] = useState<Record<string, ShopItemDraft>>({});
  const [shopEditorBusy, setShopEditorBusy] = useState<string | null>(null);

  function shopDraftFor(item: ShopItemRow): ShopItemDraft {
    return (
      shopDrafts[item.key] ?? {
        purchasable: item.purchasable,
        price: item.price != null ? String(item.price) : "",
        tier: item.tier,
      }
    );
  }

  function setShopDraft(key: string, patch: Partial<ShopItemDraft>, base: ShopItemDraft) {
    setShopDrafts((d) => ({ ...d, [key]: { ...base, ...patch } }));
  }

  async function saveShopItem(item: ShopItemRow) {
    const draft = shopDraftFor(item);
    setShopEditorBusy(item.key);
    setErrorMessage(null);
    try {
      await api.patch(`/admin/shop-items/${item.key}`, {
        purchasable: draft.purchasable,
        price: draft.purchasable ? Number(draft.price) : null,
        tier: draft.tier,
      });
      setShopDrafts((d) => {
        const next = { ...d };
        delete next[item.key];
        return next;
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-shop-items"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-items"] }),
      ]);
      setMessage(`✅ ${item.name} のショップ設定を更新しました。`);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "更新に失敗しました。");
    } finally {
      setShopEditorBusy(null);
    }
  }

  const { data: customFeaturesData } = useQuery({
    queryKey: ["admin-custom-features"],
    queryFn: () => api.get<{ features: CustomFeatureRow[] }>("/admin/custom-features"),
  });
  const [newFeatureLabel, setNewFeatureLabel] = useState("");
  const [newFeatureHp, setNewFeatureHp] = useState("0");
  const [newFeatureAtk, setNewFeatureAtk] = useState("0");
  const [newFeatureDef, setNewFeatureDef] = useState("0");
  const [newFeatureSpd, setNewFeatureSpd] = useState("0");
  const [newFeatureLuck, setNewFeatureLuck] = useState("0");
  const [customFeatureBusy, setCustomFeatureBusy] = useState(false);

  async function createCustomItem(e: FormEvent) {
    e.preventDefault();
    setCustomItemBusy(true);
    setErrorMessage(null);
    try {
      await api.post("/admin/custom-items", {
        key: newItemKey,
        name: newItemName,
        emoji: newItemEmoji,
        tier: newItemTier,
        description: newItemDescription,
        effect: newItemEffect,
        value: Number(newItemValue),
      });
      setNewItemKey("");
      setNewItemName("");
      setNewItemEmoji("");
      setNewItemDescription("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-custom-items"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-items"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-shop-items"] }),
      ]);
      setMessage(`✅ アイテム「${newItemName}」を追加しました。`);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "アイテムの追加に失敗しました。");
    } finally {
      setCustomItemBusy(false);
    }
  }

  async function deleteCustomItem(key: string) {
    setCustomItemBusy(true);
    setErrorMessage(null);
    try {
      await api.delete(`/admin/custom-items/${key}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-custom-items"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-items"] }),
      ]);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "削除に失敗しました。");
    } finally {
      setCustomItemBusy(false);
    }
  }

  async function createCustomFeature(e: FormEvent) {
    e.preventDefault();
    setCustomFeatureBusy(true);
    setErrorMessage(null);
    try {
      await api.post("/admin/custom-features", {
        label: newFeatureLabel,
        hpBonus: Number(newFeatureHp),
        atkBonus: Number(newFeatureAtk),
        defBonus: Number(newFeatureDef),
        spdBonus: Number(newFeatureSpd),
        luckBonus: Number(newFeatureLuck),
      });
      setNewFeatureLabel("");
      setNewFeatureHp("0");
      setNewFeatureAtk("0");
      setNewFeatureDef("0");
      setNewFeatureSpd("0");
      setNewFeatureLuck("0");
      await queryClient.invalidateQueries({ queryKey: ["admin-custom-features"] });
      setMessage(`✅ 趣味「${newFeatureLabel}」を追加しました。`);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "趣味の追加に失敗しました。");
    } finally {
      setCustomFeatureBusy(false);
    }
  }

  async function deleteCustomFeature(label: string) {
    setCustomFeatureBusy(true);
    setErrorMessage(null);
    try {
      await api.delete(`/admin/custom-features/${encodeURIComponent(label)}`);
      await queryClient.invalidateQueries({ queryKey: ["admin-custom-features"] });
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "削除に失敗しました。");
    } finally {
      setCustomFeatureBusy(false);
    }
  }

  const { data: itemGachaData } = useQuery({
    queryKey: ["admin-item-gacha"],
    queryFn: () => api.get<{ config: ItemGachaConfig; entries: ItemGachaEntryRow[] }>("/admin/item-gacha"),
  });
  const [itemGachaCost, setItemGachaCost] = useState("300");
  const [newPoolItemKey, setNewPoolItemKey] = useState("");
  const [newPoolWeight, setNewPoolWeight] = useState("10");
  const [itemGachaBusy, setItemGachaBusy] = useState(false);

  async function toggleItemGachaActive() {
    if (!itemGachaData) return;
    setItemGachaBusy(true);
    setErrorMessage(null);
    try {
      await api.patch("/admin/item-gacha/config", { active: !itemGachaData.config.active });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-item-gacha"] }),
        queryClient.invalidateQueries({ queryKey: ["item-gacha"] }),
      ]);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "更新に失敗しました。");
    } finally {
      setItemGachaBusy(false);
    }
  }

  async function updateItemGachaCost(e: FormEvent) {
    e.preventDefault();
    setItemGachaBusy(true);
    setErrorMessage(null);
    try {
      await api.patch("/admin/item-gacha/config", { cost: Number(itemGachaCost) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-item-gacha"] }),
        queryClient.invalidateQueries({ queryKey: ["item-gacha"] }),
      ]);
      setMessage("✅ アイテムガチャのコインを更新しました。");
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "更新に失敗しました。");
    } finally {
      setItemGachaBusy(false);
    }
  }

  async function addPoolItem(e: FormEvent) {
    e.preventDefault();
    setItemGachaBusy(true);
    setErrorMessage(null);
    try {
      await api.post("/admin/item-gacha/entries", { itemKey: newPoolItemKey, weight: Number(newPoolWeight) });
      setNewPoolItemKey("");
      setNewPoolWeight("10");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-item-gacha"] }),
        queryClient.invalidateQueries({ queryKey: ["item-gacha"] }),
      ]);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "追加に失敗しました。");
    } finally {
      setItemGachaBusy(false);
    }
  }

  async function removePoolItem(itemKey: string) {
    setItemGachaBusy(true);
    setErrorMessage(null);
    try {
      await api.delete(`/admin/item-gacha/entries/${itemKey}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-item-gacha"] }),
        queryClient.invalidateQueries({ queryKey: ["item-gacha"] }),
      ]);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "削除に失敗しました。");
    } finally {
      setItemGachaBusy(false);
    }
  }

  async function toggleLimitedGacha(banner: LimitedGachaBanner) {
    setLimitedGachaBusy(banner.key);
    try {
      await api.patch(`/admin/limited-gacha/${banner.key}`, { active: !banner.active });
      await queryClient.invalidateQueries({ queryKey: ["admin-limited-gacha"] });
      await queryClient.invalidateQueries({ queryKey: ["limited-gacha"] });
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "更新に失敗しました。");
    } finally {
      setLimitedGachaBusy(null);
    }
  }

  async function createLimitedBonus(e: FormEvent) {
    e.preventDefault();
    setLimitedBonusBusy(true);
    setErrorMessage(null);
    try {
      await api.post("/admin/limited-bonuses", {
        name: bonusName,
        description: bonusDescription,
        startsAt: new Date(bonusStartsAt).toISOString(),
        endsAt: new Date(bonusEndsAt).toISOString(),
        coinAmount: bonusCoinAmount ? Number(bonusCoinAmount) : undefined,
        itemKey: bonusItemKey || undefined,
        itemAmount: bonusItemKey ? Number(bonusItemAmount) : undefined,
      });
      setBonusName("");
      setBonusDescription("");
      setBonusStartsAt("");
      setBonusEndsAt("");
      setBonusCoinAmount("");
      setBonusItemKey("");
      setBonusItemAmount("1");
      await queryClient.invalidateQueries({ queryKey: ["admin-limited-bonuses"] });
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "作成に失敗しました。");
    } finally {
      setLimitedBonusBusy(false);
    }
  }

  async function deleteLimitedBonus(id: string) {
    setLimitedBonusBusy(id);
    setErrorMessage(null);
    try {
      await api.delete(`/admin/limited-bonuses/${id}`);
      await queryClient.invalidateQueries({ queryKey: ["admin-limited-bonuses"] });
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "削除に失敗しました。");
    } finally {
      setLimitedBonusBusy(false);
    }
  }

  async function search(e?: FormEvent) {
    e?.preventDefault();
    setSearching(true);
    setErrorMessage(null);
    try {
      const res = await api.get<{ users: AdminUser[] }>(`/admin/users?q=${encodeURIComponent(query)}`);
      setUsers(res.users);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "検索に失敗しました。");
    } finally {
      setSearching(false);
    }
  }

  function refreshSelected(patch: Partial<AdminUser>) {
    setSelected((s) => (s ? { ...s, ...patch } : s));
    setUsers((list) => list.map((u) => (u.id === patch.id ? { ...u, ...patch } : u)));
  }

  const [confirmingDeleteUser, setConfirmingDeleteUser] = useState<string | null>(null);
  const [deleteUserBusy, setDeleteUserBusy] = useState(false);

  const [confirmingDemoteUser, setConfirmingDemoteUser] = useState<string | null>(null);
  const [demoteUserBusy, setDemoteUserBusy] = useState(false);

  async function demoteSelectedUser(target: AdminUser) {
    if (confirmingDemoteUser !== target.id) {
      setConfirmingDemoteUser(target.id);
      return;
    }
    setDemoteUserBusy(true);
    setErrorMessage(null);
    try {
      await api.post(`/admin/users/${target.id}/demote`);
      refreshSelected({ id: target.id, role: "user" });
      setConfirmingDemoteUser(null);
      setMessage(`✅ ${target.displayName} の運営権限を剥奪しました。`);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "権限の剥奪に失敗しました。");
    } finally {
      setDemoteUserBusy(false);
    }
  }

  async function deleteSelectedUser(target: AdminUser) {
    if (confirmingDeleteUser !== target.id) {
      setConfirmingDeleteUser(target.id);
      return;
    }
    setDeleteUserBusy(true);
    setErrorMessage(null);
    try {
      await api.delete(`/admin/users/${target.id}`);
      setUsers((list) => list.filter((u) => u.id !== target.id));
      setSelected(null);
      setConfirmingDeleteUser(null);
      setMessage(`✅ ${target.displayName} を削除しました。`);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "削除に失敗しました。");
    } finally {
      setDeleteUserBusy(false);
    }
  }

  async function giveMoney(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const res = await api.post<{ id: string; displayName: string; money: number }>("/admin/give-money", {
        userId: selected.id,
        amount: Number(moneyAmount),
      });
      refreshSelected({ id: res.id, money: res.money });
      setMessage(`${res.displayName} に ${moneyAmount} コインを付与しました。(残高: ${res.money})`);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "コイン付与に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function giveItem(e: FormEvent) {
    e.preventDefault();
    if (!selected || !itemKey) return;
    setBusy(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const res = await api.post<{ userId: string; itemKey: string; quantity: number }>("/admin/give-item", {
        userId: selected.id,
        itemKey,
        amount: Number(itemAmount),
      });
      setMessage(`${selected.displayName} に ${itemsData?.items.find((i) => i.key === itemKey)?.name} を付与しました。(所持数: ${res.quantity})`);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "アイテム付与に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function giveCharacter(e: FormEvent) {
    e.preventDefault();
    if (!selected || !charNationality.trim() || !charGender.trim() || !charFeature.trim() || !charSecretFeature.trim())
      return;
    setBusy(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      await api.post("/admin/give-character", {
        userId: selected.id,
        nationality: charNationality,
        age: Number(charAge),
        gender: charGender,
        feature: charFeature,
        secretFeature: charSecretFeature,
        specialType: charSpecialType,
      });
      setMessage(`${selected.displayName} に運営限定キャラクターを付与しました。`);
      setCharNationality("");
      setCharGender("");
      setCharFeature("");
      setCharSecretFeature("");
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "キャラクター付与に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function broadcastItem(e: FormEvent) {
    e.preventDefault();
    if (!broadcastItemKey) return;
    setBusy(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const res = await api.post<{ recipientCount: number }>("/admin/broadcast-item", {
        itemKey: broadcastItemKey,
        amount: Number(broadcastAmount),
      });
      setMessage(`全プレイヤー(${res.recipientCount}人)にアイテムを配布しました。`);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "配布に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function sendAnnouncement(e: FormEvent) {
    e.preventDefault();
    if (!announceTitle.trim() || !announceBody.trim()) return;
    if (announceRecipient === "selected" && !selected) return;
    const attachCharacter =
      announceRecipient === "selected" &&
      announceAttachChar &&
      announceCharNationality.trim() &&
      announceCharGender.trim() &&
      announceCharFeature.trim() &&
      announceCharSecretFeature.trim();
    setBusy(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const res = await api.post<{ id: string; recipientCount: number }>("/admin/announcements", {
        title: announceTitle,
        body: announceBody,
        recipientUserId: announceRecipient === "selected" ? selected!.id : undefined,
        coinAmount: announceCoin ? Number(announceCoin) : undefined,
        itemKey: announceItemKey || undefined,
        itemAmount: announceItemKey ? Number(announceItemAmount) : undefined,
        character: attachCharacter
          ? {
              nationality: announceCharNationality,
              age: Number(announceCharAge),
              gender: announceCharGender,
              feature: announceCharFeature,
              secretFeature: announceCharSecretFeature,
              specialType: announceCharSpecialType,
            }
          : undefined,
      });
      setMessage(
        announceRecipient === "selected"
          ? `${selected!.displayName} に個人メッセージを送信しました。`
          : `お知らせを送信しました。(配布対象: ${res.recipientCount}人)`
      );
      setAnnounceTitle("");
      setAnnounceBody("");
      setAnnounceCoin("");
      setAnnounceItemKey("");
      setAnnounceItemAmount("1");
      setAnnounceAttachChar(false);
      setAnnounceCharNationality("");
      setAnnounceCharGender("");
      setAnnounceCharFeature("");
      setAnnounceCharSecretFeature("");
      await queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "お知らせの送信に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAnnouncement(id: string) {
    setDeletingAnnouncementId(id);
    setErrorMessage(null);
    try {
      await api.delete(`/admin/announcements/${id}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-announcements"] }),
        queryClient.invalidateQueries({ queryKey: ["announcements"] }),
        queryClient.invalidateQueries({ queryKey: ["announcements-unread-count"] }),
      ]);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "削除に失敗しました。");
    } finally {
      setDeletingAnnouncementId(null);
    }
  }

  return (
    <div>
      <div className="panel">
        <h1>⚙️ 運営パネル</h1>
        <p style={{ color: "var(--text-dim)" }}>運営限定。コイン・アイテムを制限なく配布できます。</p>
        {message && <p style={{ color: "var(--success)" }}>{message}</p>}
        {errorMessage && <p className="error-text">{errorMessage}</p>}
      </div>

      <form className="panel" onSubmit={search}>
        <h3>🔍 ユーザー検索</h3>
        <div className="btn-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="表示名またはメールアドレス"
            style={{
              background: "var(--bg-panel-raised)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.6rem 0.75rem",
              color: "var(--text)",
              flex: 1,
              minWidth: 200,
            }}
          />
          <button className="btn" type="submit" disabled={searching}>
            検索
          </button>
        </div>
        <div className="result-grid" style={{ marginTop: "1rem" }}>
          {users.map((u) => (
            <button
              type="button"
              className="card"
              key={u.id}
              style={{ borderColor: selected?.id === u.id ? "var(--gold)" : undefined }}
              onClick={() => setSelected(u)}
            >
              <div style={{ fontWeight: 700 }}>
                {u.displayName} {u.role === "admin" && "⚙️"}
              </div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>{u.email}</div>
              <div style={{ color: "var(--gold)", fontSize: "0.85rem" }}>💰 {u.money} コイン</div>
            </button>
          ))}
        </div>
      </form>

      {selected && (
        <div className="panel">
          <h3>対象: {selected.displayName}</h3>

          <form onSubmit={giveMoney} className="btn-row" style={{ alignItems: "center", marginBottom: "0.75rem" }}>
            <span style={{ minWidth: 100 }}>💰 コイン付与</span>
            <input
              type="number"
              min={1}
              value={moneyAmount}
              onChange={(e) => setMoneyAmount(e.target.value)}
              style={{
                background: "var(--bg-panel-raised)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "0.5rem 0.6rem",
                color: "var(--text)",
                width: 140,
              }}
            />
            <button className="btn btn-primary" type="submit" disabled={busy}>
              付与
            </button>
          </form>

          <form onSubmit={giveItem} className="btn-row" style={{ alignItems: "center" }}>
            <span style={{ minWidth: 100 }}>🎒 アイテム付与</span>
            <select
              value={itemKey}
              onChange={(e) => setItemKey(e.target.value)}
              style={{
                background: "var(--bg-panel-raised)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "0.5rem 0.6rem",
                color: "var(--text)",
              }}
            >
              <option value="">選択してください</option>
              {itemsData?.items.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.emoji} {i.name}({i.tier})
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={itemAmount}
              onChange={(e) => setItemAmount(e.target.value)}
              style={{
                background: "var(--bg-panel-raised)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "0.5rem 0.6rem",
                color: "var(--text)",
                width: 100,
              }}
            />
            <button className="btn btn-primary" type="submit" disabled={busy || !itemKey}>
              付与
            </button>
          </form>

          <form onSubmit={giveCharacter} style={{ marginTop: "1.25rem" }}>
            <h4 style={{ margin: "0 0 0.5rem" }}>⭐ 運営限定キャラクターを付与</h4>
            <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginTop: 0 }}>
              ガチャの抽選には出てこない特別なキャラクターを直接付与します(常にKMR「完璧マスターランク」)。
            </p>
            <div className="btn-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
              <input
                value={charNationality}
                onChange={(e) => setCharNationality(e.target.value)}
                placeholder="国籍(例: 運営)"
                maxLength={30}
                style={{
                  background: "var(--bg-panel-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.5rem 0.6rem",
                  color: "var(--text)",
                  width: 140,
                }}
              />
              <input
                type="number"
                value={charAge}
                onChange={(e) => setCharAge(e.target.value)}
                placeholder="年齢"
                style={{
                  background: "var(--bg-panel-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.5rem 0.6rem",
                  color: "var(--text)",
                  width: 90,
                }}
              />
              <input
                value={charGender}
                onChange={(e) => setCharGender(e.target.value)}
                placeholder="性別"
                maxLength={20}
                style={{
                  background: "var(--bg-panel-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.5rem 0.6rem",
                  color: "var(--text)",
                  width: 100,
                }}
              />
            </div>
            <div className="btn-row" style={{ alignItems: "center", flexWrap: "wrap", marginTop: "0.6rem" }}>
              <input
                value={charFeature}
                onChange={(e) => setCharFeature(e.target.value)}
                placeholder="特徴(例: 伝説の運営)"
                maxLength={40}
                style={{
                  background: "var(--bg-panel-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.5rem 0.6rem",
                  color: "var(--text)",
                  flex: 1,
                  minWidth: 160,
                }}
              />
              <input
                value={charSecretFeature}
                onChange={(e) => setCharSecretFeature(e.target.value)}
                placeholder="隠し特徴"
                maxLength={60}
                style={{
                  background: "var(--bg-panel-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.5rem 0.6rem",
                  color: "var(--text)",
                  flex: 1,
                  minWidth: 160,
                }}
              />
            </div>
            <div className="btn-row" style={{ alignItems: "center", marginTop: "0.6rem" }}>
              <select
                value={charSpecialType}
                onChange={(e) => setCharSpecialType(e.target.value as typeof SPECIAL_TYPE_ORDER[number])}
                style={{
                  background: "var(--bg-panel-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.5rem 0.6rem",
                  color: "var(--text)",
                }}
              >
                {SPECIAL_TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {SPECIAL_TYPES[t].emoji} {SPECIAL_TYPES[t].label}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={
                  busy || !charNationality.trim() || !charGender.trim() || !charFeature.trim() || !charSecretFeature.trim()
                }
              >
                付与
              </button>
            </div>
          </form>

          <div className="btn-row" style={{ marginTop: "1rem", alignItems: "center" }}>
            {currentUser?.isOwner && selected.role === "admin" && (
              <button
                type="button"
                className="btn"
                style={{ color: "var(--danger)" }}
                disabled={demoteUserBusy}
                onClick={() => demoteSelectedUser(selected)}
              >
                {confirmingDemoteUser === selected.id ? "本当に剥奪しますか?もう一度押す" : "🔒 運営権限を剥奪"}
              </button>
            )}
            <button
              type="button"
              className="btn"
              style={{ color: "var(--danger)" }}
              disabled={deleteUserBusy}
              onClick={() => deleteSelectedUser(selected)}
            >
              {confirmingDeleteUser === selected.id ? "本当に削除しますか?もう一度押す" : "🗑️ このユーザーを削除"}
            </button>
          </div>
        </div>
      )}

      <form className="panel" onSubmit={sendAnnouncement}>
        <h3>📢 お知らせを送信</h3>
        <p style={{ color: "var(--text-dim)", fontSize: "0.88rem" }}>
          全員宛にするか、検索して選択した1人だけへの個人メッセージにするか選べます。コイン・アイテム・
          運営限定キャラクターを付けると、送信と同時に配布され「お知らせ」画面に履歴として残ります。
        </p>
        <div className="btn-row" style={{ alignItems: "center", marginBottom: "0.75rem" }}>
          <span style={{ minWidth: 130 }}>宛先</span>
          <label className="btn-row" style={{ alignItems: "center", gap: "0.3rem" }}>
            <input
              type="radio"
              name="announce-recipient"
              checked={announceRecipient === "all"}
              onChange={() => setAnnounceRecipient("all")}
            />
            全員
          </label>
          <label className="btn-row" style={{ alignItems: "center", gap: "0.3rem" }}>
            <input
              type="radio"
              name="announce-recipient"
              checked={announceRecipient === "selected"}
              onChange={() => setAnnounceRecipient("selected")}
              disabled={!selected}
            />
            {selected ? `${selected.displayName} さんのみ` : "選択中のユーザーのみ(上でユーザーを検索・選択してください)"}
          </label>
        </div>
        <div className="form-field">
          <label>タイトル</label>
          <input value={announceTitle} onChange={(e) => setAnnounceTitle(e.target.value)} maxLength={60} required />
        </div>
        <div className="form-field">
          <label>本文</label>
          <textarea
            value={announceBody}
            onChange={(e) => setAnnounceBody(e.target.value)}
            maxLength={2000}
            rows={4}
            required
            style={{
              background: "var(--bg-panel-raised)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.6rem 0.75rem",
              color: "var(--text)",
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
        </div>
        <div className="btn-row" style={{ alignItems: "center", marginBottom: "0.75rem" }}>
          <span style={{ minWidth: 130 }}>💰 コイン付与(任意)</span>
          <input
            type="number"
            min={1}
            placeholder="未入力なら付与なし"
            value={announceCoin}
            onChange={(e) => setAnnounceCoin(e.target.value)}
            style={{
              background: "var(--bg-panel-raised)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.5rem 0.6rem",
              color: "var(--text)",
              width: 180,
            }}
          />
        </div>
        <div className="btn-row" style={{ alignItems: "center" }}>
          <span style={{ minWidth: 130 }}>🎒 アイテム付与(任意)</span>
          <select
            value={announceItemKey}
            onChange={(e) => setAnnounceItemKey(e.target.value)}
            style={{
              background: "var(--bg-panel-raised)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.5rem 0.6rem",
              color: "var(--text)",
            }}
          >
            <option value="">付与しない</option>
            {itemsData?.items.map((i) => (
              <option key={i.key} value={i.key}>
                {i.emoji} {i.name}({i.tier})
              </option>
            ))}
          </select>
          {announceItemKey && (
            <input
              type="number"
              min={1}
              value={announceItemAmount}
              onChange={(e) => setAnnounceItemAmount(e.target.value)}
              style={{
                background: "var(--bg-panel-raised)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "0.5rem 0.6rem",
                color: "var(--text)",
                width: 100,
              }}
            />
          )}
        </div>
        {announceRecipient === "selected" && (
          <div style={{ marginTop: "0.75rem" }}>
            <label className="btn-row" style={{ alignItems: "center", gap: "0.4rem" }}>
              <input
                type="checkbox"
                checked={announceAttachChar}
                onChange={(e) => setAnnounceAttachChar(e.target.checked)}
              />
              ⭐ 運営限定キャラクター(KMR)を添える
            </label>
            {announceAttachChar && (
              <div style={{ marginTop: "0.5rem" }}>
                <div className="btn-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    value={announceCharNationality}
                    onChange={(e) => setAnnounceCharNationality(e.target.value)}
                    placeholder="国籍(例: 運営)"
                    maxLength={30}
                    style={{
                      background: "var(--bg-panel-raised)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "0.5rem 0.6rem",
                      color: "var(--text)",
                      width: 140,
                    }}
                  />
                  <input
                    type="number"
                    value={announceCharAge}
                    onChange={(e) => setAnnounceCharAge(e.target.value)}
                    placeholder="年齢"
                    style={{
                      background: "var(--bg-panel-raised)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "0.5rem 0.6rem",
                      color: "var(--text)",
                      width: 90,
                    }}
                  />
                  <input
                    value={announceCharGender}
                    onChange={(e) => setAnnounceCharGender(e.target.value)}
                    placeholder="性別"
                    maxLength={20}
                    style={{
                      background: "var(--bg-panel-raised)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "0.5rem 0.6rem",
                      color: "var(--text)",
                      width: 100,
                    }}
                  />
                </div>
                <div className="btn-row" style={{ alignItems: "center", flexWrap: "wrap", marginTop: "0.6rem" }}>
                  <input
                    value={announceCharFeature}
                    onChange={(e) => setAnnounceCharFeature(e.target.value)}
                    placeholder="特徴(例: バグ報告の功労者)"
                    maxLength={40}
                    style={{
                      background: "var(--bg-panel-raised)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "0.5rem 0.6rem",
                      color: "var(--text)",
                      flex: 1,
                      minWidth: 160,
                    }}
                  />
                  <input
                    value={announceCharSecretFeature}
                    onChange={(e) => setAnnounceCharSecretFeature(e.target.value)}
                    placeholder="隠し特徴"
                    maxLength={60}
                    style={{
                      background: "var(--bg-panel-raised)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "0.5rem 0.6rem",
                      color: "var(--text)",
                      flex: 1,
                      minWidth: 160,
                    }}
                  />
                </div>
                <div className="btn-row" style={{ alignItems: "center", marginTop: "0.6rem" }}>
                  <select
                    value={announceCharSpecialType}
                    onChange={(e) => setAnnounceCharSpecialType(e.target.value as typeof SPECIAL_TYPE_ORDER[number])}
                    style={{
                      background: "var(--bg-panel-raised)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "0.5rem 0.6rem",
                      color: "var(--text)",
                    }}
                  >
                    {SPECIAL_TYPE_ORDER.map((t) => (
                      <option key={t} value={t}>
                        {SPECIAL_TYPES[t].emoji} {SPECIAL_TYPES[t].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
        <button
          className="btn btn-primary"
          type="submit"
          style={{ marginTop: "1rem" }}
          disabled={
            busy ||
            !announceTitle.trim() ||
            !announceBody.trim() ||
            (announceRecipient === "selected" && !selected)
          }
        >
          送信する
        </button>
      </form>

      <div className="panel">
        <h3>🗑 お知らせ削除</h3>
        <p style={{ color: "var(--text-dim)", fontSize: "0.88rem" }}>
          誤って送信したお知らせを削除します。すでに配布済みのコイン・アイテムは回収されません。
        </p>
        <div className="result-grid">
          {adminAnnouncementsData?.items.map((a) => (
            <div className="card" key={a.id}>
              <div style={{ fontWeight: 700 }}>{a.title}</div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.85rem", overflowWrap: "anywhere" }}>{a.body}</div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.8rem", margin: "0.3rem 0" }}>
                {a.recipientDisplayName ? `個人宛: ${a.recipientDisplayName}` : "全員宛"} / {new Date(a.createdAt).toLocaleString()}
              </div>
              {(a.coinAmount || a.itemKey) && (
                <div style={{ color: "var(--gold)", fontSize: "0.85rem" }}>
                  {a.coinAmount ? `💰 ${a.coinAmount}` : null}
                  {a.coinAmount && a.itemKey ? " / " : null}
                  {a.itemKey ? `🎒 ${a.itemKey} ×${a.itemAmount}` : null}
                </div>
              )}
              <button
                type="button"
                className="btn"
                style={{ color: "var(--danger)", marginTop: "0.5rem" }}
                disabled={deletingAnnouncementId === a.id}
                onClick={() => deleteAnnouncement(a.id)}
              >
                削除する
              </button>
            </div>
          ))}
          {adminAnnouncementsData?.items.length === 0 && (
            <p style={{ color: "var(--text-dim)" }}>お知らせはまだありません。</p>
          )}
        </div>
      </div>

      <form className="panel" onSubmit={broadcastItem}>
        <h3>📢 全員配布(お知らせなし)</h3>
        <p style={{ color: "var(--text-dim)", fontSize: "0.88rem" }}>登録済みの全プレイヤーにアイテムを一括配布します。</p>
        <div className="btn-row" style={{ alignItems: "center" }}>
          <select
            value={broadcastItemKey}
            onChange={(e) => setBroadcastItemKey(e.target.value)}
            style={{
              background: "var(--bg-panel-raised)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.5rem 0.6rem",
              color: "var(--text)",
            }}
          >
            <option value="">選択してください</option>
            {itemsData?.items.map((i) => (
              <option key={i.key} value={i.key}>
                {i.emoji} {i.name}({i.tier})
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={broadcastAmount}
            onChange={(e) => setBroadcastAmount(e.target.value)}
            style={{
              background: "var(--bg-panel-raised)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.5rem 0.6rem",
              color: "var(--text)",
              width: 100,
            }}
          />
          <button className="btn" type="submit" disabled={busy || !broadcastItemKey}>
            全員に配布
          </button>
        </div>
      </form>

      <div className="panel">
        <h3>🎉 期間限定ガチャ管理</h3>
        <p style={{ color: "var(--text-dim)", fontSize: "0.88rem" }}>
          ONにすると即座にガチャ画面に表示され、OFFにすると即座に非表示になります。
        </p>
        <div className="result-grid">
          {limitedGachaData?.banners.map((banner) => (
            <div className="card" key={banner.key}>
              <div style={{ fontWeight: 700 }}>{banner.name}</div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>{banner.description}</div>
              <div style={{ color: "var(--gold)", fontSize: "0.85rem", margin: "0.3rem 0" }}>
                💰 {banner.cost} コイン
              </div>
              <button
                className="btn"
                style={{ color: banner.active ? "var(--danger)" : "var(--gold)" }}
                disabled={limitedGachaBusy === banner.key}
                onClick={() => toggleLimitedGacha(banner)}
              >
                {banner.active ? "🔴 終了する" : "🟢 開始する"}
              </button>
            </div>
          ))}
          {limitedGachaData?.banners.length === 0 && (
            <p style={{ color: "var(--text-dim)" }}>期間限定ガチャはまだありません。</p>
          )}
        </div>
      </div>

      <form className="panel" onSubmit={createLimitedBonus}>
        <h3>✨ 期間限定ボーナス管理</h3>
        <p style={{ color: "var(--text-dim)", fontSize: "0.88rem" }}>
          日時を指定してコイン・アイテムを配布するキャンペーンを作成できます。期間中、プレイヤーは1回だけホーム画面から受け取れます。
        </p>
        <div className="btn-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={bonusName}
            onChange={(e) => setBonusName(e.target.value)}
            placeholder="名前(例: 週末限定ボーナス)"
            maxLength={40}
            required
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          />
        </div>
        <div className="btn-row" style={{ alignItems: "center", flexWrap: "wrap", marginTop: "0.6rem" }}>
          <input
            value={bonusDescription}
            onChange={(e) => setBonusDescription(e.target.value)}
            placeholder="説明"
            maxLength={200}
            required
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          />
        </div>
        <div className="btn-row" style={{ alignItems: "center", flexWrap: "wrap", marginTop: "0.6rem" }}>
          <label className="btn-row" style={{ alignItems: "center", gap: "0.4rem" }}>
            開始
            <input
              type="datetime-local"
              value={bonusStartsAt}
              onChange={(e) => setBonusStartsAt(e.target.value)}
              required
              style={inputStyle}
            />
          </label>
          <label className="btn-row" style={{ alignItems: "center", gap: "0.4rem" }}>
            終了
            <input
              type="datetime-local"
              value={bonusEndsAt}
              onChange={(e) => setBonusEndsAt(e.target.value)}
              required
              style={inputStyle}
            />
          </label>
        </div>
        <div className="btn-row" style={{ alignItems: "center", flexWrap: "wrap", marginTop: "0.6rem" }}>
          <label className="btn-row" style={{ alignItems: "center", gap: "0.4rem" }}>
            💰 コイン(任意)
            <input
              type="number"
              min={1}
              value={bonusCoinAmount}
              onChange={(e) => setBonusCoinAmount(e.target.value)}
              style={{ ...inputStyle, width: 120 }}
            />
          </label>
          <label className="btn-row" style={{ alignItems: "center", gap: "0.4rem" }}>
            🎒 アイテム(任意)
            <select value={bonusItemKey} onChange={(e) => setBonusItemKey(e.target.value)} style={inputStyle}>
              <option value="">付与しない</option>
              {itemsData?.items.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.emoji} {i.name}({i.tier})
                </option>
              ))}
            </select>
          </label>
          {bonusItemKey && (
            <input
              type="number"
              min={1}
              value={bonusItemAmount}
              onChange={(e) => setBonusItemAmount(e.target.value)}
              style={{ ...inputStyle, width: 100 }}
            />
          )}
        </div>
        <button
          className="btn btn-primary"
          type="submit"
          style={{ marginTop: "0.75rem" }}
          disabled={limitedBonusBusy === true || !bonusName.trim() || !bonusStartsAt || !bonusEndsAt || (!bonusCoinAmount && !bonusItemKey)}
        >
          作成する
        </button>

        <div className="result-grid" style={{ marginTop: "1rem" }}>
          {limitedBonusesData?.bonuses.map((b) => (
            <div className="card" key={b.id}>
              <div style={{ fontWeight: 700 }}>{b.name}</div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>{b.description}</div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.8rem", margin: "0.3rem 0" }}>
                {new Date(b.startsAt).toLocaleString()} 〜 {new Date(b.endsAt).toLocaleString()}
              </div>
              <div style={{ color: "var(--gold)", fontSize: "0.85rem" }}>
                {b.coinAmount ? `💰 ${b.coinAmount}` : null}
                {b.coinAmount && b.itemKey ? " / " : null}
                {b.itemKey ? `🎒 ${b.itemKey} ×${b.itemAmount}` : null}
              </div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.8rem", margin: "0.3rem 0" }}>
                受取済み: {b._count.claims}人
              </div>
              <button
                type="button"
                className="btn"
                style={{ color: "var(--danger)" }}
                disabled={limitedBonusBusy === b.id}
                onClick={() => deleteLimitedBonus(b.id)}
              >
                削除する
              </button>
            </div>
          ))}
          {limitedBonusesData?.bonuses.length === 0 && (
            <p style={{ color: "var(--text-dim)" }}>期間限定ボーナスはまだありません。</p>
          )}
        </div>
      </form>

      <div className="panel">
        <h3>🏪 ショップエディター</h3>
        <p style={{ color: "var(--text-dim)", fontSize: "0.88rem" }}>
          標準アイテム・独自アイテムどちらもここで一括管理できます。カテゴリー(レア度)ごとに分かれて表示され、
          ショップに並べるか・価格をいくらにするかを自由に変更できます。
        </p>
        {ITEM_TIER_OPTIONS.map((tier) => {
          const itemsInTier = shopItemsData?.items.filter((i) => i.tier === tier) ?? [];
          if (itemsInTier.length === 0) return null;
          return (
            <div key={tier} style={{ marginTop: "1rem" }}>
              <h4 style={{ margin: "0 0 0.5rem", textTransform: "uppercase", color: "var(--text-dim)" }}>{tier}</h4>
              <div className="result-grid">
                {itemsInTier.map((item) => {
                  const draft = shopDraftFor(item);
                  return (
                    <div className="card" key={item.key}>
                      <div style={{ fontWeight: 700 }}>
                        {item.emoji} {item.name} {item.isCustom && <span style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>(独自)</span>}
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.4rem" }}>
                        <input
                          type="checkbox"
                          checked={draft.purchasable}
                          onChange={(e) => setShopDraft(item.key, { purchasable: e.target.checked }, draft)}
                        />
                        ショップに並べる
                      </label>
                      {draft.purchasable && (
                        <input
                          value={draft.price}
                          onChange={(e) => setShopDraft(item.key, { price: e.target.value }, draft)}
                          placeholder="価格"
                          style={{ ...inputStyle, width: "100%", marginTop: "0.4rem" }}
                        />
                      )}
                      <select
                        value={draft.tier}
                        onChange={(e) => setShopDraft(item.key, { tier: e.target.value }, draft)}
                        style={{ ...inputStyle, width: "100%", marginTop: "0.4rem" }}
                      >
                        {ITEM_TIER_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ marginTop: "0.5rem", width: "100%" }}
                        disabled={shopEditorBusy === item.key || (draft.purchasable && !draft.price)}
                        onClick={() => saveShopItem(item)}
                      >
                        保存
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <form className="panel" onSubmit={createCustomItem}>
        <h3>🎒 独自アイテム管理</h3>
        <p style={{ color: "var(--text-dim)", fontSize: "0.88rem" }}>
          コード変更・再デプロイなしでアイテムを追加できます。効果は既存の種類から選んでください。
        </p>
        <div className="result-grid">
          {customItemsData?.items.map((item) => (
            <div className="card" key={item.key}>
              <div style={{ fontWeight: 700 }}>
                {item.emoji} {item.name}
              </div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>{item.description}</div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.8rem", margin: "0.3rem 0" }}>
                {item.tier} / {item.effect}={item.value}
                {item.purchasable && ` / 💰${item.price}`}
              </div>
              <button
                type="button"
                className="btn"
                style={{ color: "var(--danger)" }}
                disabled={customItemBusy}
                onClick={() => deleteCustomItem(item.key)}
              >
                削除
              </button>
            </div>
          ))}
          {customItemsData?.items.length === 0 && (
            <p style={{ color: "var(--text-dim)" }}>独自アイテムはまだありません。</p>
          )}
        </div>

        <div className="btn-row" style={{ marginTop: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={newItemKey}
            onChange={(e) => setNewItemKey(e.target.value)}
            placeholder="キー(半角英数字、例: lucky_charm)"
            style={inputStyle}
          />
          <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="名前" style={inputStyle} />
          <input
            value={newItemEmoji}
            onChange={(e) => setNewItemEmoji(e.target.value)}
            placeholder="絵文字"
            style={{ ...inputStyle, width: 70 }}
          />
          <select value={newItemTier} onChange={(e) => setNewItemTier(e.target.value as typeof newItemTier)} style={inputStyle}>
            {ITEM_TIER_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="btn-row" style={{ marginTop: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={newItemEffect}
            onChange={(e) => setNewItemEffect(e.target.value as typeof newItemEffect)}
            style={{ ...inputStyle, minWidth: 260 }}
          >
            {ITEM_EFFECT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            value={newItemValue}
            onChange={(e) => setNewItemValue(e.target.value)}
            placeholder="value(倍率/割合/ラウンド数)"
            style={{ ...inputStyle, width: 100 }}
          />
        </div>
        <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginTop: "0.6rem" }}>
          ショップで売るかどうか・価格は、追加後に下の「🏪 ショップエディター」から設定してください。
        </p>
        <textarea
          value={newItemDescription}
          onChange={(e) => setNewItemDescription(e.target.value)}
          placeholder="説明文"
          rows={2}
          style={{ ...inputStyle, width: "100%", marginTop: "0.6rem", resize: "vertical" }}
        />
        <button
          className="btn btn-primary"
          type="submit"
          style={{ marginTop: "0.8rem" }}
          disabled={customItemBusy || !newItemKey.trim() || !newItemName.trim() || !newItemEmoji.trim() || !newItemDescription.trim()}
        >
          アイテムを追加
        </button>
      </form>

      <form className="panel" onSubmit={createCustomFeature}>
        <h3>🎭 独自の趣味(特徴)管理</h3>
        <p style={{ color: "var(--text-dim)", fontSize: "0.88rem" }}>
          ガチャで生成されるキャラクターの「趣味」を追加できます。ステータスボーナスは任意です。
        </p>
        <div className="result-grid">
          {customFeaturesData?.features.map((f) => (
            <div className="card" key={f.label}>
              <div style={{ fontWeight: 700 }}>🎭{f.label}</div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>
                HP{f.hpBonus >= 0 ? "+" : ""}
                {f.hpBonus} ATK{f.atkBonus >= 0 ? "+" : ""}
                {f.atkBonus} DEF{f.defBonus >= 0 ? "+" : ""}
                {f.defBonus} SPD{f.spdBonus >= 0 ? "+" : ""}
                {f.spdBonus} 運{f.luckBonus >= 0 ? "+" : ""}
                {f.luckBonus}
              </div>
              <button
                type="button"
                className="btn"
                style={{ color: "var(--danger)", marginTop: "0.4rem" }}
                disabled={customFeatureBusy}
                onClick={() => deleteCustomFeature(f.label)}
              >
                削除
              </button>
            </div>
          ))}
          {customFeaturesData?.features.length === 0 && (
            <p style={{ color: "var(--text-dim)" }}>独自の趣味はまだありません。</p>
          )}
        </div>

        <div className="btn-row" style={{ marginTop: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={newFeatureLabel}
            onChange={(e) => setNewFeatureLabel(e.target.value)}
            placeholder="趣味(例: 釣り好き)"
            style={inputStyle}
          />
          <input value={newFeatureHp} onChange={(e) => setNewFeatureHp(e.target.value)} placeholder="HP" style={{ ...inputStyle, width: 70 }} />
          <input
            value={newFeatureAtk}
            onChange={(e) => setNewFeatureAtk(e.target.value)}
            placeholder="ATK"
            style={{ ...inputStyle, width: 70 }}
          />
          <input
            value={newFeatureDef}
            onChange={(e) => setNewFeatureDef(e.target.value)}
            placeholder="DEF"
            style={{ ...inputStyle, width: 70 }}
          />
          <input
            value={newFeatureSpd}
            onChange={(e) => setNewFeatureSpd(e.target.value)}
            placeholder="SPD"
            style={{ ...inputStyle, width: 70 }}
          />
          <input
            value={newFeatureLuck}
            onChange={(e) => setNewFeatureLuck(e.target.value)}
            placeholder="運"
            style={{ ...inputStyle, width: 70 }}
          />
        </div>
        <button
          className="btn btn-primary"
          type="submit"
          style={{ marginTop: "0.8rem" }}
          disabled={customFeatureBusy || !newFeatureLabel.trim()}
        >
          趣味を追加
        </button>
      </form>

      <div className="panel">
        <h3>🎒 アイテムガチャ管理</h3>
        <p style={{ color: "var(--text-dim)", fontSize: "0.88rem" }}>
          プレイヤーがコインでアイテムを引けるガチャです。中身(抽選プール)を自由に編集できます。
        </p>
        <div className="btn-row" style={{ alignItems: "center" }}>
          <button
            className="btn"
            style={{ color: itemGachaData?.config.active ? "var(--danger)" : "var(--gold)" }}
            disabled={itemGachaBusy || !itemGachaData}
            onClick={toggleItemGachaActive}
          >
            {itemGachaData?.config.active ? "🔴 停止する" : "🟢 開催する"}
          </button>
          <span style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
            現在のコスト: {itemGachaData?.config.cost}コイン
          </span>
        </div>

        <form className="btn-row" style={{ marginTop: "0.8rem", alignItems: "center" }} onSubmit={updateItemGachaCost}>
          <input
            value={itemGachaCost}
            onChange={(e) => setItemGachaCost(e.target.value)}
            placeholder="コスト"
            style={{ ...inputStyle, width: 100 }}
          />
          <button className="btn" type="submit" disabled={itemGachaBusy}>
            コストを更新
          </button>
        </form>

        <h4 style={{ marginTop: "1.2rem" }}>抽選プール</h4>
        <div className="result-grid">
          {itemGachaData?.entries.map((e) => (
            <div className="card" key={e.itemKey}>
              <div style={{ fontWeight: 700 }}>
                {e.item ? `${e.item.emoji} ${e.item.name}` : `⚠️ ${e.itemKey}(不明)`}
              </div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>重み: {e.weight}</div>
              <button
                type="button"
                className="btn"
                style={{ color: "var(--danger)", marginTop: "0.4rem" }}
                disabled={itemGachaBusy}
                onClick={() => removePoolItem(e.itemKey)}
              >
                プールから外す
              </button>
            </div>
          ))}
          {itemGachaData?.entries.length === 0 && <p style={{ color: "var(--text-dim)" }}>プールが空です。</p>}
        </div>

        <form className="btn-row" style={{ marginTop: "1rem", alignItems: "center", flexWrap: "wrap" }} onSubmit={addPoolItem}>
          <select value={newPoolItemKey} onChange={(e) => setNewPoolItemKey(e.target.value)} style={{ ...inputStyle, minWidth: 200 }}>
            <option value="">アイテムを選択</option>
            {itemsData?.items.map((i) => (
              <option key={i.key} value={i.key}>
                {i.emoji} {i.name}({i.tier})
              </option>
            ))}
          </select>
          <input
            value={newPoolWeight}
            onChange={(e) => setNewPoolWeight(e.target.value)}
            placeholder="重み"
            style={{ ...inputStyle, width: 80 }}
          />
          <button className="btn btn-primary" type="submit" disabled={itemGachaBusy || !newPoolItemKey}>
            プールに追加
          </button>
        </form>
      </div>
    </div>
  );
}
