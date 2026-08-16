import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ItemDef } from "@identity-slot/game-core";
import { api, ApiError } from "../lib/api";
import { accentStyle } from "../lib/itemDisplay";
import { useAuth } from "../lib/auth-context";

interface LimitedBonus {
  id: string;
  name: string;
  description: string;
  endsAt: string;
  coinAmount: number | null;
  itemKey: string | null;
  itemAmount: number | null;
  item: ItemDef | null;
  claimed: boolean;
}

function formatRemaining(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "終了間近";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours >= 24) return `残り${Math.floor(hours / 24)}日`;
  if (hours >= 1) return `残り${hours}時間`;
  return `残り${Math.max(1, Math.floor(ms / (1000 * 60)))}分`;
}

export function LimitedBonusPanel() {
  const { refresh } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["limited-bonuses"],
    queryFn: () => api.get<{ bonuses: LimitedBonus[] }>("/limited-bonuses"),
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function claim(bonus: LimitedBonus) {
    setBusyId(bonus.id);
    setMessage(null);
    try {
      await api.post(`/limited-bonuses/${bonus.id}/claim`);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["limited-bonuses"] }), refresh()]);
      setMessage(`🎉 「${bonus.name}」を受け取りました!`);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "受け取りに失敗しました。");
    } finally {
      setBusyId(null);
    }
  }

  const bonuses = data?.bonuses ?? [];
  if (bonuses.length === 0) return null;

  return (
    <div className="panel">
      <h2 style={{ margin: "0 0 0.5rem" }}>✨ 期間限定ボーナス</h2>
      {message && <p style={{ color: "var(--success)" }}>{message}</p>}
      <div className="result-grid">
        {bonuses.map((b) => (
          <div key={b.id} className="shop-card" style={accentStyle("#f1c40f")}>
            <span className="shop-tier-badge">{formatRemaining(b.endsAt)}</span>
            <div className="shop-card-icon">{b.item?.emoji ?? "🎁"}</div>
            <div className="shop-card-name">{b.name}</div>
            <div className="shop-card-desc" style={{ margin: "0.3rem 0 0.6rem" }}>
              {b.description}
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginBottom: "0.6rem" }}>
              {b.coinAmount ? `💰 ${b.coinAmount}コイン` : null}
              {b.coinAmount && b.item ? " / " : null}
              {b.item ? `${b.item.emoji} ${b.item.name} ×${b.itemAmount}` : null}
            </div>
            <button
              className="btn btn-primary"
              disabled={b.claimed || busyId === b.id}
              onClick={() => claim(b)}
              style={{ width: "100%" }}
            >
              {b.claimed ? "受け取り済み" : "受け取る"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
