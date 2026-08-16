import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { accentStyle } from "../lib/itemDisplay";

interface AchievementRow {
  id: string;
  name: string;
  description: string;
  title: string;
  unlocked: boolean;
}

interface ProfileData {
  selectedTitle: string | null;
}

export function AchievementsPage() {
  const { refresh } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["achievements"],
    queryFn: () => api.get<{ items: AchievementRow[] }>("/achievements"),
  });
  const { data: profileData } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<ProfileData>("/profile"),
  });

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function selectTitle(title: string | null) {
    setBusy(true);
    setMessage(null);
    try {
      await api.patch("/profile/title", { title });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["profile"] }), refresh()]);
      setMessage(title ? `称号を「${title}」に変更しました。` : "称号を外しました。");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "変更に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  const unlockedCount = data?.items.filter((a) => a.unlocked).length ?? 0;
  const total = data?.items.length ?? 0;

  return (
    <div className="panel">
      <h1>🏆 実績</h1>
      <p style={{ color: "var(--text-dim)" }}>
        解除済み: {unlockedCount} / {total}
      </p>
      {profileData?.selectedTitle && (
        <p>
          現在の称号: <strong style={{ color: "var(--gold)" }}>「{profileData.selectedTitle}」</strong>
          <button className="btn" style={{ marginLeft: "0.6rem" }} disabled={busy} onClick={() => selectTitle(null)}>
            外す
          </button>
        </p>
      )}
      {message && <p style={{ color: "var(--success)" }}>{message}</p>}
      {isLoading && <p>読み込み中……</p>}

      <div className="result-grid" style={{ marginTop: "1rem" }}>
        {data?.items.map((a) => (
          <div className="shop-card" style={accentStyle(a.unlocked ? "#f1c40f" : "#4a4a58")} key={a.id}>
            <span className="shop-tier-badge">{a.unlocked ? "解除済み" : "未解除"}</span>
            <div className="shop-card-icon">{a.unlocked ? "🏆" : "🔒"}</div>
            <div className="shop-card-name">{a.name}</div>
            <div className="shop-card-desc">{a.description}</div>
            <div style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginBottom: "0.5rem" }}>称号: {a.title}</div>
            {a.unlocked && (
              <button
                className="btn btn-primary"
                disabled={busy || profileData?.selectedTitle === a.title}
                onClick={() => selectTitle(a.title)}
              >
                {profileData?.selectedTitle === a.title ? "装備中" : "称号にする"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
