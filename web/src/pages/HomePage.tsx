import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DailyBonusPanel } from "../components/DailyBonusPanel";
import { LimitedBonusPanel } from "../components/LimitedBonusPanel";
import { api } from "../lib/api";
import { accentStyle } from "../lib/itemDisplay";
import { useAuth } from "../lib/auth-context";

interface ProfileData {
  selectedTitle: string | null;
}

interface Shortcut {
  to: string;
  emoji: string;
  label: string;
  desc: string;
  color: string;
}

const SHORTCUTS: Shortcut[] = [
  { to: "/gacha", emoji: "🎰", label: "ガチャ", desc: "新しい「もう一つの人生」を引く", color: "#f1c40f" },
  { to: "/battle", emoji: "⚔️", label: "バトル", desc: "タイマン・レイドに挑む", color: "#e74c3c" },
  { to: "/shop", emoji: "🛒", label: "ショップ", desc: "アイテム購入・マーケット", color: "#4dd0e1" },
  { to: "/history", emoji: "📖", label: "図鑑", desc: "手に入れたキャラを見る", color: "#9b59b6" },
  { to: "/train", emoji: "💪", label: "育成", desc: "キャラを強化・売却", color: "#2ecc71" },
  { to: "/trade", emoji: "🔄", label: "トレード", desc: "他プレイヤーと交換", color: "#3498db" },
  { to: "/achievements", emoji: "🏆", label: "実績", desc: "称号を集める", color: "#d4af37" },
  { to: "/ranking", emoji: "📊", label: "ランキング", desc: "みんなの記録を見る", color: "#ff9500" },
];

export function HomePage() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<ProfileData>("/profile"),
  });

  return (
    <div>
      <div className="panel">
        <h1>🏠 ホーム</h1>
        <p style={{ fontSize: "1.15rem" }}>
          {data?.selectedTitle && <span style={{ color: "var(--gold)" }}>「{data.selectedTitle}」</span>} {user?.displayName}
        </p>
        <p style={{ color: "var(--text-dim)" }}>今日も「もう一つの人生」を探しに行きましょう。</p>
      </div>

      <DailyBonusPanel />
      <LimitedBonusPanel />

      <div className="panel">
        <h3>🧭 メニュー</h3>
        <div className="result-grid">
          {SHORTCUTS.map((s) => (
            <Link key={s.to} to={s.to} className="shop-card" style={{ ...accentStyle(s.color), display: "block", textDecoration: "none" }}>
              <div className="shop-card-icon">{s.emoji}</div>
              <div className="shop-card-name">{s.label}</div>
              <div className="shop-card-desc" style={{ margin: "0.3rem 0 0" }}>
                {s.desc}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
