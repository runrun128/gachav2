import { RARITY_ORDER, Rarity } from "@identity-slot/game-core";
import { useQuery } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { RarityTag } from "../components/RarityTag";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth-context";

interface ProfileData {
  displayName: string;
  money: number;
  role: string;
  totalSpins: number;
  bestRarity: Rarity;
  rarityCounts: Record<Rarity, number>;
}

export function ProfilePage() {
  const { user, promote } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<ProfileData>("/profile"),
  });

  const [code, setCode] = useState("");
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onPromote(e: FormEvent) {
    e.preventDefault();
    setPromoteError(null);
    setSubmitting(true);
    try {
      await promote(code);
      setCode("");
    } catch (err) {
      setPromoteError(err instanceof ApiError ? err.message : "昇格に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return <p>読み込み中……</p>;
  if (error || !data) return <p className="error-text">プロフィールの取得に失敗しました。</p>;

  return (
    <div>
      <div className="panel">
        <h1>🪪 PLAYER PROFILE</h1>
        <p style={{ fontSize: "1.2rem" }}>{data.displayName}</p>
        <div className="btn-row" style={{ marginBottom: "1.25rem" }}>
          <div className="card">🎰 総ガチャ回数: {data.totalSpins}</div>
          <div className="card">
            🏆 最高レア度: <RarityTag rarity={data.bestRarity} />
          </div>
          <div className="card">💰 所持金: {data.money} コイン</div>
        </div>
        <h3>📊 レアリティ内訳</h3>
        <div className="btn-row">
          {RARITY_ORDER.map((r) => (
            <div className="card" key={r}>
              <RarityTag rarity={r} /> {data.rarityCounts[r]}
            </div>
          ))}
        </div>
      </div>

      {user?.role !== "admin" && (
        <form className="panel" onSubmit={onPromote}>
          <h3>⚙️ 運営コードで昇格</h3>
          <p style={{ color: "var(--text-dim)", fontSize: "0.88rem" }}>
            運営スタッフの方は、発行された運営コードを入力すると管理者権限が付与されます。
          </p>
          <div className="btn-row" style={{ alignItems: "center" }}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="運営コード"
              style={{
                background: "var(--bg-panel-raised)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "0.6rem 0.75rem",
                color: "var(--text)",
              }}
            />
            <button className="btn" type="submit" disabled={submitting || !code}>
              昇格する
            </button>
          </div>
          {promoteError && <p className="error-text">{promoteError}</p>}
        </form>
      )}
    </div>
  );
}
