import { BOSSES, BOSS_ORDER, BossKey } from "@identity-slot/game-core";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginTop: "0.6rem" }}>
          {BOSSES[bossKey].emoji} {BOSSES[bossKey].name}: {BOSSES[bossKey].desc}
        </p>
      </form>

      <div className="panel">
        <h3>📯 募集中の部屋</h3>
        {lobbies.length === 0 && <p style={{ color: "var(--text-dim)" }}>現在募集中の部屋はありません。</p>}
        <div className="result-grid">
          {lobbies.map((l) => (
            <div className="card" key={l.roomId}>
              <div style={{ fontWeight: 700 }}>{l.roomName}</div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
                {l.bossEmoji} {l.bossName}
              </div>
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
    </div>
  );
}
