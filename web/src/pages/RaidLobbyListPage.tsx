import { BOSSES, BOSS_ORDER, BossKey } from "@identity-slot/game-core";
import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BossImage } from "../components/BossImage";
import { useSocket } from "../lib/socket-context";

interface LobbySummary {
  roomId: string;
  roomName: string;
  bossKey: BossKey;
  bossName: string;
  bossEmoji: string;
  hostUserId: string;
  hostDisplayName: string;
  participantCount: number;
  maxParticipants: number;
}

interface ActiveRaid {
  roomId: string;
  roomName: string;
  bossName: string;
  bossEmoji: string;
  phase: "select" | "round";
  roundNo: number;
  participantCount: number;
  spectatorCount: number;
}

interface AckResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function RaidLobbyListPage() {
  const { socket, connected } = useSocket();
  const navigate = useNavigate();

  const [lobbies, setLobbies] = useState<LobbySummary[]>([]);
  const [roomName, setRoomName] = useState("");
  const [bossKey, setBossKey] = useState<BossKey>(BOSS_ORDER[0]);
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRaids, setActiveRaids] = useState<ActiveRaid[]>([]);

  useEffect(() => {
    if (!socket || !connected) return;
    socket.emit("raid:myRoom", {}, (res: AckResponse<{ roomId: string | null }>) => {
      if (res.ok && res.data) setActiveRoomId(res.data.roomId);
    });
  }, [socket, connected]);

  useEffect(() => {
    if (!socket) return;

    function onLobbiesUpdated(payload: { lobbies: LobbySummary[] }) {
      setLobbies(payload.lobbies);
    }
    socket.on("raid:lobbiesUpdated", onLobbiesUpdated);
    socket.emit("raid:listLobbies", {}, (res: AckResponse<{ lobbies: LobbySummary[] }>) => {
      if (res.ok && res.data) setLobbies(res.data.lobbies);
    });

    return () => {
      socket.off("raid:lobbiesUpdated", onLobbiesUpdated);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    function onActiveUpdated(payload: { raids: ActiveRaid[] }) {
      setActiveRaids(payload.raids);
    }
    socket.on("raid:activeUpdated", onActiveUpdated);
    socket.emit("raid:listActive", {}, (res: AckResponse<{ raids: ActiveRaid[] }>) => {
      if (res.ok && res.data) setActiveRaids(res.data.raids);
    });

    return () => {
      socket.off("raid:activeUpdated", onActiveUpdated);
    };
  }, [socket]);

  function createLobby(e: FormEvent) {
    e.preventDefault();
    if (!socket) return;
    setCreating(true);
    setError(null);
    socket.emit("raid:createLobby", { roomName, bossKey }, (res: AckResponse<{ roomId: string }>) => {
      setCreating(false);
      if (res.ok && res.data) {
        navigate(`/raid/${res.data.roomId}`);
      } else {
        setError(res.error ?? "部屋の作成に失敗しました。");
      }
    });
  }

  function joinLobby(roomId: string) {
    if (!socket) return;
    setJoiningId(roomId);
    setError(null);
    socket.emit("raid:joinLobby", { roomId }, (res: AckResponse<{ roomId: string }>) => {
      setJoiningId(null);
      if (res.ok && res.data) {
        navigate(`/raid/${res.data.roomId}`);
      } else {
        setError(res.error ?? "参加に失敗しました。");
      }
    });
  }

  return (
    <div>
      {activeRoomId && (
        <div className="panel">
          <p>🐉 進行中のレイドがあります。</p>
          <button className="btn btn-primary" onClick={() => navigate(`/raid/${activeRoomId}`)}>
            レイドに戻る
          </button>
        </div>
      )}

      <form className="panel" onSubmit={createLobby}>
        <h1>🐉 レイド</h1>
        <p style={{ color: "var(--text-dim)" }}>
          {connected ? "🟢 接続中" : "🔴 接続待機中……"} — 部屋を作って仲間を待つか、募集中の部屋に参加しましょう(最大4人)。
        </p>
        {error && <p className="error-text">{error}</p>}

        <div className="btn-row" style={{ alignItems: "center" }}>
          <input
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="部屋の名前(例: 初心者歓迎)"
            maxLength={30}
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
          <select
            value={bossKey}
            onChange={(e) => setBossKey(e.target.value as BossKey)}
            style={{
              background: "var(--bg-panel-raised)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.6rem 0.75rem",
              color: "var(--text)",
            }}
          >
            {BOSS_ORDER.map((key) => (
              <option key={key} value={key}>
                {BOSSES[key].emoji} {BOSSES[key].name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" type="submit" disabled={creating || !roomName.trim() || !connected}>
            部屋を作る
          </button>
        </div>
        <div className="btn-row" style={{ alignItems: "center", marginTop: "0.6rem" }}>
          <BossImage bossKey={bossKey} emoji={BOSSES[bossKey].emoji} alt={BOSSES[bossKey].name} size={48} />
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", margin: 0 }}>
            {BOSSES[bossKey].name}: {BOSSES[bossKey].desc}
          </p>
        </div>
      </form>

      <div className="panel">
        <h3>📯 募集中の部屋</h3>
        {lobbies.length === 0 && <p style={{ color: "var(--text-dim)" }}>現在募集中の部屋はありません。</p>}
        <div className="result-grid">
          {lobbies.map((l) => (
            <div className="card" key={l.roomId}>
              <div className="btn-row" style={{ alignItems: "center", marginBottom: "0.4rem" }}>
                <BossImage bossKey={l.bossKey} emoji={l.bossEmoji} alt={l.bossName} size={36} />
                <div style={{ fontWeight: 700 }}>{l.roomName}</div>
              </div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>{l.bossName}</div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>主催: {l.hostDisplayName}</div>
              <div style={{ margin: "0.4rem 0" }}>
                👥 {l.participantCount} / {l.maxParticipants} 人
              </div>
              <button
                className="btn btn-primary"
                disabled={joiningId === l.roomId || l.participantCount >= l.maxParticipants}
                onClick={() => joinLobby(l.roomId)}
              >
                {l.participantCount >= l.maxParticipants ? "満員" : "参加する"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>👀 観戦できるレイド</h3>
        {activeRaids.length === 0 && <p style={{ color: "var(--text-dim)" }}>現在観戦できるレイドはありません。</p>}
        <div className="result-grid">
          {activeRaids.map((r) => (
            <div className="card" key={r.roomId}>
              <div style={{ fontWeight: 700 }}>
                {r.bossEmoji} {r.roomName}
              </div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
                {r.bossName} ・ {r.phase === "select" ? "キャラクター選択中" : `ラウンド ${r.roundNo}`}
                {r.spectatorCount > 0 && ` ・ 👀${r.spectatorCount}`}
              </div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>👥 {r.participantCount}人参加中</div>
              <Link className="btn" to={`/raid/${r.roomId}`} style={{ marginTop: "0.6rem", display: "inline-block" }}>
                観戦する
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
