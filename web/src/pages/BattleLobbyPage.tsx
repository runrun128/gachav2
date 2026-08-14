import { MAX_BATTLE_ROUNDS } from "@identity-slot/game-core";
import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useSocket } from "../lib/socket-context";

interface UserResult {
  id: string;
  displayName: string;
  online: boolean;
}

interface ActiveBattle {
  roomId: string;
  phase: "select" | "round" | "finished";
  roundNo: number;
  players: string[];
  spectatorCount: number;
}

interface AckResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function BattleLobbyPage() {
  const { socket, connected } = useSocket();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [outgoing, setOutgoing] = useState<{ challengeId: string; targetName: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [maxRounds, setMaxRounds] = useState(String(MAX_BATTLE_ROUNDS));
  const [itemsAllowed, setItemsAllowed] = useState(true);
  const [activeBattles, setActiveBattles] = useState<ActiveBattle[]>([]);

  useEffect(() => {
    if (!socket || !connected) return;
    socket.emit("battle:myRoom", {}, (res: AckResponse<{ roomId: string | null }>) => {
      if (res.ok && res.data) setActiveRoomId(res.data.roomId);
    });
  }, [socket, connected]);

  useEffect(() => {
    if (!socket) return;
    function onUpdate(payload: { challengeId: string; status: string; message?: string }) {
      setOutgoing((cur) => (cur && cur.challengeId === payload.challengeId ? null : cur));
      if (payload.status === "declined") setStatusMessage("相手に挑戦を断られました。");
      else if (payload.status === "expired") setStatusMessage("挑戦がタイムアウトしました。");
      else if (payload.status === "error") setStatusMessage(payload.message ?? "エラーが発生しました。");
    }
    socket.on("battle:challengeUpdate", onUpdate);
    return () => {
      socket.off("battle:challengeUpdate", onUpdate);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    function onActiveUpdated(payload: { battles: ActiveBattle[] }) {
      setActiveBattles(payload.battles);
    }
    socket.on("battle:activeUpdated", onActiveUpdated);
    socket.emit("battle:listActive", {}, (res: AckResponse<{ battles: ActiveBattle[] }>) => {
      if (res.ok && res.data) setActiveBattles(res.data.battles);
    });
    return () => {
      socket.off("battle:activeUpdated", onActiveUpdated);
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

  function challenge(target: UserResult) {
    if (!socket) return;
    setStatusMessage(null);
    socket.emit(
      "battle:challenge",
      { targetUserId: target.id, settings: { maxRounds: Number(maxRounds), itemsAllowed } },
      (res: AckResponse<{ challengeId: string }>) => {
        if (res.ok && res.data) {
          setOutgoing({ challengeId: res.data.challengeId, targetName: target.displayName });
        } else {
          setStatusMessage(res.error ?? "挑戦に失敗しました。");
        }
      }
    );
  }

  return (
    <div>
      {activeRoomId && (
        <div className="panel">
          <p>⚔️ 進行中のバトルがあります。</p>
          <Link className="btn btn-primary" to={`/battle/${activeRoomId}`}>
            バトルに戻る
          </Link>
        </div>
      )}

      <div className="panel">
        <h1>⚔️ バトル</h1>
        <p style={{ color: "var(--text-dim)" }}>
          {connected ? "🟢 接続中" : "🔴 接続待機中……"} — 表示名で相手を検索して挑戦しましょう。オンラインの相手のみ挑戦できます。
        </p>
        {statusMessage && <p className="error-text">{statusMessage}</p>}

        <div className="btn-row" style={{ alignItems: "center", flexWrap: "wrap", marginBottom: "0.85rem" }}>
          <label className="btn-row" style={{ alignItems: "center", gap: "0.4rem" }}>
            ターン制限
            <input
              type="number"
              min={3}
              max={30}
              value={maxRounds}
              onChange={(e) => setMaxRounds(e.target.value)}
              style={{
                background: "var(--bg-panel-raised)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "0.4rem 0.5rem",
                color: "var(--text)",
                width: 70,
              }}
            />
            ラウンド
          </label>
          <label className="btn-row" style={{ alignItems: "center", gap: "0.4rem" }}>
            <input type="checkbox" checked={itemsAllowed} onChange={(e) => setItemsAllowed(e.target.checked)} />
            アイテム使用を許可
          </label>
        </div>

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
                  onClick={() => challenge(u)}
                >
                  {u.online ? "挑戦する" : "オフライン"}
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
          <p>⏳ <strong>{outgoing.targetName}</strong> に挑戦を送りました。応答を待っています……</p>
        </div>
      )}

      <div className="panel">
        <h3>👀 観戦できるバトル</h3>
        {activeBattles.length === 0 && (
          <p style={{ color: "var(--text-dim)" }}>現在観戦できるバトルはありません。</p>
        )}
        <div className="result-grid">
          {activeBattles.map((b) => (
            <div className="card" key={b.roomId}>
              <div style={{ fontWeight: 700 }}>
                {b.players[0] ?? "?"} vs {b.players[1] ?? "?"}
              </div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
                {b.phase === "select" ? "キャラクター選択中" : `ラウンド ${b.roundNo}`}
                {b.spectatorCount > 0 && ` ・ 👀${b.spectatorCount}`}
              </div>
              <Link className="btn" to={`/battle/${b.roomId}`} style={{ marginTop: "0.6rem", display: "inline-block" }}>
                観戦する
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
