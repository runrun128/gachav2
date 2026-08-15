import { ItemDef, itemSellPrice } from "@identity-slot/game-core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth-context";

type InventoryItemRow = ItemDef & { itemKey: string; quantity: number };

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

  return (
    <div className="panel">
      <h1>🎒 INVENTORY</h1>
      {message && <p style={{ color: "var(--success)" }}>{message}</p>}
      {isLoading && <p>読み込み中……</p>}
      {data && data.items.length === 0 && (
        <p style={{ color: "var(--text-dim)" }}>所持アイテムはありません。ショップで購入できます。</p>
      )}
      <div className="result-grid">
        {data?.items.map((item) => (
          <div className="card" key={item.itemKey}>
            <div style={{ fontWeight: 700 }}>
              {item.emoji} {item.name} ×{item.quantity}
            </div>
            <div style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginTop: "0.4rem" }}>{item.desc}</div>
            <div className="btn-row" style={{ alignItems: "center", marginTop: "0.6rem" }}>
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
  );
}
