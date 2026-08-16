import { Rarity, SpecialType } from "@identity-slot/game-core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CharacterPicker } from "../components/CharacterPicker";
import { useBgm } from "../hooks/useBgm";
import { api } from "../lib/api";
import { useAudio } from "../lib/audio-context";
import { useAuth } from "../lib/auth-context";
import { useSocket } from "../lib/socket-context";

interface TournamentMatchDTO {
  id: string;
  player1Id: string;
  player2Id: string;
  winnerId: string | null;
  log: string[];
}

interface TournamentStateDTO {
  roomId: string;
  roomName: string;
  bracketSize: number;
  hostUserId: string;
  phase: "lobby" | "select" | "running" | "finished";
  participantIds: string[];
  participantNames: Record<string, string>;
  charactersSelected: Record<string, boolean>;
  currentRound: number;
  rounds: TournamentMatchDTO[][];
  championId: string | null;
  runnerUpId: string | null;
  finishReason: string | null;
  rewards: Record<string, number>;
}

interface CharacterRow {
  id: string;
  nationality: string;
  age: number;
  gender: string;
  feature: string;
  rarity: Rarity;
  secretFeature: string | null;
  specialType: SpecialType | null;
  level: number;
}

interface AckResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

function roundLabel(index: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - index;
  if (fromEnd === 0) return "🏆 決勝";
  if (fromEnd === 1) return "準決勝";
  if (fromEnd === 2) return "準々決勝";
  return `${index + 1}回戦`;
}

export function TournamentRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { socket } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<TournamentStateDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  const { data: historyData } = useQuery({
    queryKey: ["tournament-characters"],
    queryFn: () => api.get<{ items: CharacterRow[] }>("/characters/mine"),
    enabled: state?.phase === "select",
  });

  useEffect(() => {
    if (!socket || !roomId) return;

    function onState(payload: TournamentStateDTO) {
      if (payload.roomId === roomId) {
        setState(payload);
        setError(null);
        setSelecting(false);
        setConfirmingLeave(false);
      }
    }
    socket.on("tournament:state", onState);
    socket.emit("tournament:joinRoom", { roomId }, (res: AckResponse) => {
      if (!res.ok) setError(res.error ?? "トーナメントへの参加に失敗しました。");
    });

    return () => {
      socket.off("tournament:state", onState);
    };
  }, [socket, roomId]);

  const { playSfx } = useAudio();
  useBgm("battle");

  const lastRoundsCountRef = useRef(0);
  useEffect(() => {
    const count = state?.rounds.length ?? 0;
    if (count > lastRoundsCountRef.current) {
      lastRoundsCountRef.current = count;
      if (count > 0) playSfx("special");
    }
    if (count === 0) lastRoundsCountRef.current = 0;
  }, [state?.rounds.length, playSfx]);

  const finishedSfxPlayedRef = useRef(false);
  useEffect(() => {
    if (state?.phase !== "finished") {
      finishedSfxPlayedRef.current = false;
      return;
    }
    if (finishedSfxPlayedRef.current || !state.championId) return;
    finishedSfxPlayedRef.current = true;
    playSfx(state.championId === user?.id ? "victory" : "defeat");
  }, [state?.phase, state?.championId, user?.id, playSfx]);

  if (error) {
    return (
      <div className="panel">
        <p className="error-text">{error}</p>
        <button className="btn" onClick={() => navigate("/battle/tournament")}>
          トーナメント一覧に戻る
        </button>
      </div>
    );
  }

  if (!state || !user) {
    return <p>読み込み中……</p>;
  }

  const isHost = state.hostUserId === user.id;
  const totalRounds = Math.log2(state.bracketSize);
  const mySelected = state.charactersSelected[user.id];

  function selectCharacter(characterId: string) {
    if (selecting) return;
    setSelecting(true);
    socket?.emit("tournament:selectCharacter", { roomId, characterId }, (res: AckResponse) => {
      if (!res.ok && res.error !== "すでに選択済みです。") {
        setSelecting(false);
        setError(res.error ?? "選択に失敗しました。");
      }
    });
  }

  function startTournament() {
    socket?.emit("tournament:start", { roomId }, (res: AckResponse) => {
      if (!res.ok) setError(res.error ?? "開始に失敗しました。");
    });
  }

  function leaveTournament() {
    if (!confirmingLeave) {
      setConfirmingLeave(true);
      return;
    }
    setConfirmingLeave(false);
    socket?.emit("tournament:leave", { roomId }, () => navigate("/battle/tournament"));
  }

  return (
    <div className="battle-compact">
      <div className="panel">
        <h1 style={{ margin: 0 }}>🏆 {state.roomName}</h1>
        <p style={{ color: "var(--text-dim)" }}>
          {state.bracketSize}人トーナメント
          {state.phase === "running" && ` — ${roundLabel(state.currentRound - 1, totalRounds)}進行中`}
        </p>
        {state.finishReason && <p className="error-text">{state.finishReason}</p>}
      </div>

      {state.phase === "lobby" && (
        <div className="panel">
          <h3>
            👥 参加者({state.participantIds.length}/{state.bracketSize})
          </h3>
          <div className="result-grid">
            {state.participantIds.map((pid) => (
              <div className="card" key={pid}>
                {state.participantNames[pid]} {pid === state.hostUserId && "👑"}
              </div>
            ))}
          </div>
          <div className="btn-row" style={{ marginTop: "1rem" }}>
            {isHost ? (
              <button
                className="btn btn-primary"
                disabled={state.participantIds.length !== state.bracketSize}
                onClick={startTournament}
              >
                ▶️ 開始({state.participantIds.length}/{state.bracketSize}人)
              </button>
            ) : (
              <p style={{ color: "var(--text-dim)" }}>参加者が揃うのを待っています……</p>
            )}
            <button className="btn" style={{ color: "var(--danger)" }} onClick={leaveTournament}>
              {confirmingLeave ? "本当に? もう一度押す" : "退出する"}
            </button>
          </div>
        </div>
      )}

      {state.phase === "select" && (
        <div className="panel">
          <h3>バトルに使うキャラクターを選択してください</h3>
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
            {Object.values(state.charactersSelected).filter(Boolean).length}/{state.participantIds.length} 人が選択済み
          </p>
          {mySelected ? (
            <p style={{ color: "var(--text-dim)" }}>他の参加者の選択を待っています……</p>
          ) : (
            <CharacterPicker characters={historyData?.items ?? []} disabled={selecting} onSelect={selectCharacter} />
          )}
        </div>
      )}

      {(state.phase === "running" || state.phase === "finished") && (
        <div className="panel">
          <h3>📋 トーナメント表</h3>
          {state.rounds.map((matches, roundIdx) => (
            <div key={roundIdx} style={{ marginBottom: "1rem" }}>
              <h4 style={{ margin: "0 0 0.4rem" }}>{roundLabel(roundIdx, totalRounds)}</h4>
              <div className="result-grid">
                {matches.map((m) => (
                  <div className="card" key={m.id} style={{ cursor: "pointer" }} onClick={() => setExpandedMatchId((v) => (v === m.id ? null : m.id))}>
                    <div style={{ fontWeight: m.winnerId === m.player1Id ? 700 : 400, color: m.winnerId === m.player1Id ? "var(--gold)" : undefined }}>
                      {m.winnerId === m.player1Id && "🏅 "}
                      {state.participantNames[m.player1Id]}
                    </div>
                    <div style={{ color: "var(--text-dim)", fontSize: "0.8rem", margin: "0.2rem 0" }}>vs</div>
                    <div style={{ fontWeight: m.winnerId === m.player2Id ? 700 : 400, color: m.winnerId === m.player2Id ? "var(--gold)" : undefined }}>
                      {m.winnerId === m.player2Id && "🏅 "}
                      {state.participantNames[m.player2Id]}
                    </div>
                    {!m.winnerId && <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", margin: "0.4rem 0 0" }}>⏳ 対戦準備中……</p>}
                    {expandedMatchId === m.id && (
                      <div
                        style={{
                          marginTop: "0.5rem",
                          maxHeight: "10rem",
                          overflowY: "auto",
                          background: "var(--bg-panel-raised)",
                          borderRadius: 8,
                          padding: "0.5rem",
                          fontSize: "0.78rem",
                        }}
                      >
                        {m.log.map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {state.phase === "finished" && state.championId && (
        <div className={`panel reveal-pop${state.championId === user.id ? " glow-ssr" : ""}`}>
          <h2>🏆 優勝: {state.participantNames[state.championId]}!</h2>
          <p>
            🎁 報酬: <strong>+{state.rewards[user.id] ?? 0}</strong> コイン
            {state.championId === user.id && " (👑優勝賞金込み)"}
            {state.runnerUpId === user.id && " (🥈準優勝賞金込み)"}
          </p>
          <button className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={() => navigate("/battle/tournament")}>
            トーナメント一覧に戻る
          </button>
        </div>
      )}
    </div>
  );
}
