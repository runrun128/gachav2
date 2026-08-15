import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useSocket } from "../lib/socket-context";

interface UserResult {
  id: string;
  displayName: string;
  online: boolean;
}

interface AckResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function TradeLobbyPage() {
  const { socket, connected } = useSocket();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [outgoing, setOutgoing] = useState<{ inviteId: string; targetName: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (!socket || !connected) return;
    socket.emit("trade:myRoom", {}, (res: AckResponse<{ roomId: string | null }>) => {
      if (res.ok && res.data) setActiveRoomId(res.data.roomId);
    });
  }, [socket, connected]);

  useEffect(() => {
    if (!socket) return;
    function onUpdate(payload: { inviteId: string; status: string; message?: string }) {
      setOutgoing((cur) => (cur && cur.inviteId === payload.inviteId ? null : cur));
      if (payload.status === "declined") setStatusMessage("相手にトレードを断られました。");
      else if (payload.status === "expired") setStatusMessage("申し込みがタイムアウトしました。");
      else if (payload.status === "error") setStatusMessage(payload.message ?? "エラーが発生しました。");
    }
    socket.on("trade:inviteUpdate", onUpdate);
    return () => {
      socket.off("trade:inviteUpdate", onUpdate);
    };
  }, [socket]);

  async function search(e?: FormEvent) {
    e?.preventDefault();
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    setStatusMessage(null);
    try {
      const res = await api.get<{ users: UserResult[] }>(`/users/search?q=${encodeURIComponent(query)}`);
      setResults(res.users);
    } catch {
      setStatusMessage("検索に失敗しました。");
    } finally {
      setSearching(false);
    }
  }

  function invite(target: UserResult) {
    if (!socket) return;
    setStatusMessage(null);
    socket.emit("trade:invite", { targetUserId: target.id }, (res: AckResponse<{ inviteId: string }>) => {
      if (res.ok && res.data) {
        setOutgoing({ inviteId: res.data.inviteId, targetName: target.displayName });
      } else {
        setStatusMessage(res.error ?? "申し込みに失敗しました。");
      }
    });
  }

  return (
    <div>
      {activeRoomId && (
        <div className="panel">
          <p>🔄 進行中のトレードがあります。</p>
          <button className="btn btn-primary" onClick={() => navigate(`/trade/${activeRoomId}`)}>
            トレードに戻る
          </button>
        </div>
      )}

      <div className="panel">
        <h1>🔄 トレード</h1>
        <p style={{ color: "var(--text-dim)" }}>
          {connected ? "🟢 接続中" : "🔴 接続待機中……"} — 表示名で相手を検索してトレードを申し込みましょう。オンラインの相手のみ申し込めます。
        </p>
        {statusMessage && <p className="error-text">{statusMessage}</p>}

        <form onSubmit={search} className="btn-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="表示名で検索"
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
          <button className="btn" type="submit" disabled={searching}>
            検索
          </button>
        </form>

        <div className="result-grid" style={{ marginTop: "1rem" }}>
          {results.map((u) => (
            <div className="card" key={u.id}>
              <div>
                {u.online ? <span className="online-dot" /> : <span className="offline-dot" />}
                {u.displayName}
              </div>
              <div className="btn-row" style={{ marginTop: "0.6rem" }}>
                <button
                  className="btn btn-primary"
                  disabled={!u.online || !!outgoing || !connected}
                  onClick={() => invite(u)}
                >
                  {u.online ? "申し込む" : "オフライン"}
                </button>
              </div>
            </div>
          ))}
          {results.length === 0 && query && !searching && (
            <p style={{ color: "var(--text-dim)" }}>該当するユーザーが見つかりません。</p>
          )}
        </div>
      </div>

      {outgoing && (
        <div className="panel">
          <p>
            ⏳ <strong>{outgoing.targetName}</strong> にトレードを申し込みました。応答を待っています……
          </p>
        </div>
      )}
    </div>
  );
}
