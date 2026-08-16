import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { accentStyle } from "../lib/itemDisplay";
import { useSocket } from "../lib/socket-context";

interface AckResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface ModeCard {
  key: string;
  to: string;
  emoji: string;
  label: string;
  desc: string;
  color: string;
  comingSoon?: boolean;
}

const MODES: ModeCard[] = [
  { key: "duel", to: "/battle/duel", emoji: "⚔️", label: "タイマン", desc: "1対1のリアルタイム対戦", color: "#e74c3c" },
  { key: "raid", to: "/battle/raid", emoji: "🐉", label: "レイド", desc: "最大4人でボスに挑む協力戦", color: "#9b59b6" },
  { key: "duo", to: "", emoji: "👯", label: "デュオ", desc: "2人1組のチーム戦(近日公開)", color: "#4dd0e1", comingSoon: true },
];

export function BattleHubPage() {
  const { socket, connected } = useSocket();
  const navigate = useNavigate();
  const [activeDuelId, setActiveDuelId] = useState<string | null>(null);
  const [activeRaidId, setActiveRaidId] = useState<string | null>(null);

  useEffect(() => {
    if (!socket || !connected) return;
    socket.emit("battle:myRoom", {}, (res: AckResponse<{ roomId: string | null }>) => {
      if (res.ok && res.data) setActiveDuelId(res.data.roomId);
    });
    socket.emit("raid:myRoom", {}, (res: AckResponse<{ roomId: string | null }>) => {
      if (res.ok && res.data) setActiveRaidId(res.data.roomId);
    });
  }, [socket, connected]);

  return (
    <div>
      {activeDuelId && (
        <div className="panel">
          <p>⚔️ 進行中のタイマンがあります。</p>
          <button className="btn btn-primary" onClick={() => navigate(`/battle/duel/${activeDuelId}`)}>
            対戦に戻る
          </button>
        </div>
      )}
      {activeRaidId && (
        <div className="panel">
          <p>🐉 進行中のレイドがあります。</p>
          <button className="btn btn-primary" onClick={() => navigate(`/battle/raid/${activeRaidId}`)}>
            レイドに戻る
          </button>
        </div>
      )}

      <div className="panel">
        <h1>⚔️ バトル</h1>
        <p style={{ color: "var(--text-dim)" }}>モードを選んでください。</p>

        <div className="result-grid">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              className="shop-card"
              style={{ ...accentStyle(m.color), textAlign: "left", opacity: m.comingSoon ? 0.6 : 1 }}
              disabled={m.comingSoon}
              onClick={() => !m.comingSoon && navigate(m.to)}
            >
              {m.comingSoon && <span className="shop-tier-badge">近日公開</span>}
              <div className="shop-card-icon">{m.emoji}</div>
              <div className="shop-card-name">{m.label}</div>
              <div className="shop-card-desc" style={{ margin: "0.3rem 0 0" }}>
                {m.desc}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
