import { ItemDef, ItemTier, itemSellPrice } from "@identity-slot/game-core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { TIER_COLOR, accentStyle } from "../lib/itemDisplay";

type InventoryItemRow = ItemDef & { itemKey: string; quantity: number };

const ITEM_TIER_ORDER: ItemTier[] = ["shop", "common", "uncommon", "rare", "legendary"];

export function InventoryPage() {
  const { refresh } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => api.get<{ items: InventoryItemRow[] }>("/inventory"),
  });
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function sell(item: InventoryItemRow) {
    const amount = Math.max(1, Math.min(item.quantity, Number(amounts[item.itemKey]) || 1));
    setBusyKey(item.itemKey);
    setMessage(null);
    try {
      const res = await api.post<{ price: number }>("/shop/sell", { itemKey: item.itemKey, amount });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["inventory"] }), refresh()]);
      setMessage(`${item.name}を${amount}個売って${res.price}コイン手に入れました。`);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "売却に失敗しました。");
    } finally {
      setBusyKey(null);
    }
  }

  const groups = ITEM_TIER_ORDER.map((tier) => ({
    tier,
    items: (data?.items ?? []).filter((i) => i.tier === tier),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="panel">
      <h1>🎒 持ち物</h1>
      {message && <p style={{ color: "var(--success)" }}>{message}</p>}
      {isLoading && <p>読み込み中……</p>}
      {data && data.items.length === 0 && (
        <p style={{ color: "var(--text-dim)" }}>所持アイテムはありません。ショップで購入できます。</p>
      )}

      {groups.map((g) => (
        <div key={g.tier} style={{ marginTop: "1.2rem" }}>
          <h4 className="shop-section-title" style={accentStyle(TIER_COLOR[g.tier])}>
            {g.tier}
          </h4>
          <div className="result-grid">
            {g.items.map((item) => (
              <div className="shop-card" style={accentStyle(TIER_COLOR[g.tier])} key={item.itemKey}>
                <span className="shop-tier-badge">×{item.quantity}</span>
                <div className="shop-card-icon">{item.emoji}</div>
                <div className="shop-card-name">{item.name}</div>
                <div className="shop-card-desc">{item.desc}</div>
                <div className="btn-row" style={{ alignItems: "center" }}>
                  <input
                    type="number"
                    min={1}
                    max={item.quantity}
                    value={amounts[item.itemKey] ?? "1"}
                    onChange={(e) => setAmounts((a) => ({ ...a, [item.itemKey]: e.target.value }))}
                    style={{
                      background: "var(--bg-panel-raised)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "0.4rem 0.5rem",
                      color: "var(--text)",
                      width: 70,
                    }}
                  />
                  <button className="btn" disabled={busyKey === item.itemKey} onClick={() => sell(item)}>
                    💰{itemSellPrice(item)}で売る
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
