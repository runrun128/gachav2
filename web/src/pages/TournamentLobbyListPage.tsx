import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../lib/socket-context";

interface LobbySummary {
  roomId: string;
  roomName: string;
  bracketSize: number;
  hostUserId: string;
  hostDisplayName: string;
  participantCount: number;
}

interface AckResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

const BRACKET_SIZES = [4, 8] as const;

export function TournamentLobbyListPage() {
  const { socket, connected } = useSocket();
  const navigate = useNavigate();

  const [lobbies, setLobbies] = useState<LobbySummary[]>([]);
  const [roomName, setRoomName] = useState("");
  const [bracketSize, setBracketSize] = useState<number>(4);
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (!socket || !connected) return;
    socket.emit("tournament:myRoom", {}, (res: AckResponse<{ roomId: string | null }>) => {
      if (res.ok && res.data) setActiveRoomId(res.data.roomId);
    });
  }, [socket, connected]);

  useEffect(() => {
    if (!socket) return;

    function onLobbiesUpdated(payload: { lobbies: LobbySummary[] }) {
      setLobbies(payload.lobbies);
    }
    socket.on("tournament:lobbiesUpdated", onLobbiesUpdated);
    socket.emit("tournament:listLobbies", {}, (res: AckResponse<{ lobbies: LobbySummary[] }>) => {
      if (res.ok && res.data) setLobbies(res.data.lobbies);
    });

    return () => {
      socket.off("tournament:lobbiesUpdated", onLobbiesUpdated);
    };
  }, [socket]);

  function createLobby(e: FormEvent) {
    e.preventDefault();
    if (!socket) return;
    setCreating(true);
    setError(null);
    socket.emit("tournament:createLobby", { roomName, bracketSize }, (res: AckResponse<{ roomId: string }>) => {
      setCreating(false);
      if (res.ok && res.data) {
        navigate(`/battle/tournament/${res.data.roomId}`);
      } else {
        setError(res.error ?? "部屋の作成に失敗しました。");
      }
    });
  }

  function joinLobby(roomId: string) {
    if (!socket) return;
    setJoiningId(roomId);
    setError(null);
    socket.emit("tournament:joinLobby", { roomId }, (res: AckResponse<{ roomId: string }>) => {
      setJoiningId(null);
      if (res.ok && res.data) {
        navigate(`/battle/tournament/${res.data.roomId}`);
      } else {
        setError(res.error ?? "参加に失敗しました。");
      }
    });
  }

  return (
    <div>
      {activeRoomId && (
        <div className="panel">
          <p>🏆 進行中のトーナメントがあります。</p>
          <button className="btn btn-primary" onClick={() => navigate(`/battle/tournament/${activeRoomId}`)}>
            トーナメントに戻る
          </button>
        </div>
      )}

      <form className="panel" onSubmit={createLobby}>
        <h1>🏆 トーナメント戦</h1>
        <p style={{ color: "var(--text-dim)" }}>
          {connected ? "🟢 接続中" : "🔴 接続待機中……"} — 4人または8人の勝ち上がり式トーナメント。定員が揃うと各試合は自動で決着します。
        </p>
        {error && <p className="error-text">{error}</p>}

        <div className="btn-row" style={{ alignItems: "center" }}>
          <input
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="部屋の名前(例: 初心者杯)"
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
            value={bracketSize}
            onChange={(e) => setBracketSize(Number(e.target.value))}
            style={{
              background: "var(--bg-panel-raised)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.6rem 0.75rem",
              color: "var(--text)",
            }}
          >
            {BRACKET_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}人トーナメント
              </option>
            ))}
          </select>
          <button className="btn btn-primary" type="submit" disabled={creating || !roomName.trim() || !connected}>
            部屋を作る
          </button>
        </div>
      </form>

      <div className="panel">
        <h3>📯 募集中の部屋</h3>
        {lobbies.length === 0 && <p style={{ color: "var(--text-dim)" }}>現在募集中の部屋はありません。</p>}
        <div className="result-grid">
          {lobbies.map((l) => (
            <div className="card" key={l.roomId}>
              <div style={{ fontWeight: 700 }}>🏆 {l.roomName}</div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>{l.bracketSize}人トーナメント</div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>主催: {l.hostDisplayName}</div>
              <div style={{ margin: "0.4rem 0" }}>
                👥 {l.participantCount} / {l.bracketSize} 人
              </div>
              <button
                className="btn btn-primary"
                disabled={joiningId === l.roomId || l.participantCount >= l.bracketSize}
                onClick={() => joinLobby(l.roomId)}
              >
                {l.participantCount >= l.bracketSize ? "満員" : "参加する"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
