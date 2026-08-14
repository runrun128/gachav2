import { ItemDef } from "@identity-slot/game-core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth-context";

export function ShopPage() {
  const { refresh } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["shop"],
    queryFn: () => api.get<{ items: ItemDef[] }>("/shop"),
  });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function buy(itemKey: string) {
    setBusyKey(itemKey);
    setMessage(null);
    try {
      await api.post("/shop/buy", { itemKey, amount: 1 });
      await refresh();
      setMessage("購入しました。");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "購入に失敗しました。");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="panel">
      <h1>🛒 ITEM SHOP</h1>
      {message && <p className="error-text" style={{ color: "var(--success)" }}>{message}</p>}
      {isLoading && <p>読み込み中……</p>}
      <div className="result-grid">
        {data?.items.map((item) => (
          <div className="card" key={item.key}>
            <div style={{ fontWeight: 700 }}>
              {item.emoji} {item.name}
            </div>
            <div style={{ color: "var(--text-dim)", fontSize: "0.85rem", margin: "0.4rem 0" }}>{item.desc}</div>
            <div className="btn-row" style={{ alignItems: "center" }}>
              <span style={{ color: "var(--gold)" }}>{item.price} コイン</span>
              <button className="btn" disabled={busyKey === item.key} onClick={() => buy(item.key)}>
                購入
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
