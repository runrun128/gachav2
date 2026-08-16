import { ItemDef, Rarity, SpecialType } from "@identity-slot/game-core";
import { useQuery } from "@tanstack/react-query";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BattleLog } from "../components/BattleLog";
import { CharacterPicker } from "../components/CharacterPicker";
import { FighterVitals } from "../components/FighterVitals";
import { RarityTag } from "../components/RarityTag";
import { useBgm } from "../hooks/useBgm";
import { useRoundReplay } from "../hooks/useRoundReplay";
import { useStepSfx } from "../hooks/useStepSfx";
import { api } from "../lib/api";
import { useAudio } from "../lib/audio-context";
import { useAuth } from "../lib/auth-context";
import { useSocket } from "../lib/socket-context";

const SELF_ONLY_ITEM_EFFECTS = new Set(["heal", "invincible_1", "invincible_n", "shield_partial_1"]);

interface RoyaleRoundStepDTO {
  upToLine: number;
  participantHp: Record<string, number>;
  actorId: string;
}

interface RoyaleFighterDTO {
  nationality: string;
  age: number;
  gender: string;
  feature: string;
  rarity: Rarity;
  level: number;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  hasSpecial: boolean;
  specialType: SpecialType | null;
  moveName: string;
  specialCooldown: number;
  hasGamble: boolean;
  gambleCooldown: number;
  retired: boolean;
  poisonRounds: number;
  atkDebuffRounds: number;
  invincibleRounds: number;
}

interface RoyaleParticipantDTO {
  userId: string;
  displayName: string;
  characterSelected: boolean;
  actionSubmitted: boolean;
  eliminated: boolean;
  fighter: RoyaleFighterDTO | null;
}

interface ChatMessageDTO {
  userId: string;
  displayName: string;
  text: string;
  at: number;
}

interface RoyaleStateDTO {
  roomId: string;
  roomName: string;
  hostUserId: string;
  phase: "lobby" | "select" | "round" | "finished";
  roundNo: number;
  spectatorCount: number;
  chatLog: ChatMessageDTO[];
  log: string[];
  roundSteps: RoyaleRoundStepDTO[];
  winnerUserId: string | null;
  finishReason: string | null;
  rewards: Record<string, number>;
  maxParticipants: number;
  minParticipants: number;
  eliminationOrder: string[];
  participants: RoyaleParticipantDTO[];
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

interface PendingAction {
  type: "attack" | "special" | "gamble" | "item";
  itemKey?: string;
}

export function RoyaleRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { socket } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<RoyaleStateDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [pendingTargetAction, setPendingTargetAction] = useState<PendingAction | null>(null);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessageDTO[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");

  const { data: historyData } = useQuery({
    queryKey: ["royale-characters"],
    queryFn: () => api.get<{ items: CharacterRow[] }>("/characters/mine"),
    enabled: state?.phase === "select",
  });

  const { data: inventoryData } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => api.get<{ items: (ItemDef & { itemKey: string; quantity: number })[] }>("/inventory"),
    enabled: state?.phase === "round",
  });

  useEffect(() => {
    if (!socket || !roomId) return;

    function onState(payload: RoyaleStateDTO) {
      if (payload.roomId === roomId) {
        setState(payload);
        setChatMessages(payload.chatLog);
        setError(null);
        setShowItemPicker(false);
        setPendingTargetAction(null);
        setConfirmingLeave(false);
        setSelecting(false);
        setSubmitting(false);
      }
    }
    function onChat(payload: ChatMessageDTO) {
      setChatMessages((prev) => [...prev, payload].slice(-50));
    }
    socket.on("royale:state", onState);
    socket.on("royale:chat", onChat);
    socket.emit("royale:joinRoom", { roomId }, (res: AckResponse) => {
      if (res.ok) return;
      if (res.error === "このバトルロイヤルの参加者ではありません。") {
        socket.emit("royale:spectate", { roomId }, (res2: AckResponse) => {
          if (!res2.ok) setError(res2.error ?? "観戦に失敗しました。");
        });
      } else {
        setError(res.error ?? "バトルロイヤルへの参加に失敗しました。");
      }
    });

    return () => {
      socket.off("royale:state", onState);
      socket.off("royale:chat", onChat);
      socket.emit("royale:unspectate", { roomId }, () => {});
    };
  }, [socket, roomId]);

  const { visibleLogCount, previousLogCount, activeStep } = useRoundReplay(state?.log.length ?? 0, state?.roundSteps);

  const { playSfx } = useAudio();
  useBgm("battle");
  useStepSfx(state?.log, previousLogCount, visibleLogCount);

  const finishedSfxPlayedRef = useRef(false);
  useEffect(() => {
    if (state?.phase !== "finished") {
      finishedSfxPlayedRef.current = false;
      return;
    }
    if (finishedSfxPlayedRef.current) return;
    finishedSfxPlayedRef.current = true;
    playSfx(state.winnerUserId === user?.id ? "victory" : "defeat");
  }, [state?.phase, state?.winnerUserId, user?.id, playSfx]);

  if (error) {
    return (
      <div className="panel">
        <p className="error-text">{error}</p>
        <button className="btn" onClick={() => navigate("/battle/royale")}>
          バトルロイヤル一覧に戻る
        </button>
      </div>
    );
  }

  if (!state || !user) {
    return <p>読み込み中……</p>;
  }

  const isSpectator = !state.participants.some((p) => p.userId === user.id);
  const me = state.participants.find((p) => p.userId === user.id);
  const isHost = state.hostUserId === user.id;
  const aliveOpponents = state.participants.filter((p) => p.userId !== user.id && !p.eliminated && p.fighter);

  function selectCharacter(characterId: string) {
    if (selecting) return;
    setSelecting(true);
    socket?.emit("royale:selectCharacter", { roomId, characterId }, (res: AckResponse) => {
      if (!res.ok && res.error !== "すでに選択済みです。") {
        setSelecting(false);
        setError(res.error ?? "選択に失敗しました。");
      }
    });
  }

  function submitAction(action: { type: string; itemKey?: string; targetId?: string }) {
    if (submitting) return;
    setSubmitting(true);
    setPendingTargetAction(null);
    setShowItemPicker(false);
    socket?.emit("royale:action", { roomId, action }, (res: AckResponse) => {
      if (!res.ok && res.error !== "すでに行動を選択済みです。") {
        setSubmitting(false);
        setError(res.error ?? "行動の送信に失敗しました。");
      }
    });
  }

  function beginAction(action: PendingAction) {
    if (aliveOpponents.length === 1) {
      submitAction({ ...action, targetId: aliveOpponents[0].userId });
      return;
    }
    setPendingTargetAction(action);
  }

  function beginSpecial() {
    const stype = me?.fighter?.specialType;
    if (stype === "heal" || stype === "shield") {
      submitAction({ type: "special" });
      return;
    }
    beginAction({ type: "special" });
  }

  function beginItem(itemKey: string) {
    const item = inventoryData?.items.find((i) => i.itemKey === itemKey);
    if (item && SELF_ONLY_ITEM_EFFECTS.has(item.effect)) {
      submitAction({ type: "item", itemKey });
      return;
    }
    beginAction({ type: "item", itemKey });
  }

  function startRoyale() {
    socket?.emit("royale:start", { roomId }, (res: AckResponse) => {
      if (!res.ok) setError(res.error ?? "開始に失敗しました。");
    });
  }

  function leaveRoyale() {
    if (!confirmingLeave) {
      setConfirmingLeave(true);
      return;
    }
    setConfirmingLeave(false);
    socket?.emit("royale:leave", { roomId }, () => navigate("/battle/royale"));
  }

  function sendChat(e: FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;
    socket.emit("royale:chat", { roomId, text: chatInput }, (res: AckResponse) => {
      if (res.ok) setChatInput("");
    });
  }

  // 脱落順(先に脱落=下位)を逆順にして、優勝者を先頭にした最終順位を作る
  const placements = state.phase === "finished" ? [...state.eliminationOrder].reverse() : [];
  if (state.winnerUserId && !placements.includes(state.winnerUserId)) placements.unshift(state.winnerUserId);

  return (
    <div className="battle-compact">
      <div className="panel">
        <h1 style={{ margin: 0 }}>🌀 {state.roomName}</h1>
        <p style={{ color: "var(--text-dim)" }}>
          バトルロイヤル
          {state.phase === "round" && ` — ラウンド ${state.roundNo}`}
        </p>
        {isSpectator && (
          <p style={{ color: "var(--gold)" }}>
            👀 観戦中{state.spectatorCount > 1 && `(${state.spectatorCount}人)`}
          </p>
        )}

        {state.phase !== "lobby" && (
          <BattleLog log={state.log} visibleLogCount={visibleLogCount} previousLogCount={previousLogCount} />
        )}

        {(state.phase === "round" || state.phase === "finished") && (
          <div className="btn-row" style={{ alignItems: "stretch", flexWrap: "wrap", marginTop: "0.4rem" }}>
            {state.participants.map((p) => (
              <RoyaleFighterPanel
                key={p.userId}
                participant={p}
                isSelf={p.userId === user.id}
                winner={p.userId === state.winnerUserId}
                hpOverride={activeStep?.participantHp[p.userId]}
                isActing={activeStep?.actorId === p.userId}
              />
            ))}
          </div>
        )}
      </div>

      {state.phase === "lobby" && (
        <div className="panel">
          <h3>
            👥 参加者({state.participants.length}/{state.maxParticipants})
          </h3>
          <div className="result-grid">
            {state.participants.map((p) => (
              <div className="card" key={p.userId}>
                {p.displayName} {p.userId === state.hostUserId && "👑"}
              </div>
            ))}
          </div>
          {isSpectator ? (
            <p style={{ color: "var(--text-dim)", marginTop: "1rem" }}>開始を待っています……</p>
          ) : (
            <div className="btn-row" style={{ marginTop: "1rem" }}>
              {isHost ? (
                <button
                  className="btn btn-primary"
                  disabled={state.participants.length < state.minParticipants}
                  onClick={startRoyale}
                >
                  ▶️ 開始({state.participants.length}/{state.minParticipants}人以上)
                </button>
              ) : (
                <p style={{ color: "var(--text-dim)" }}>主催者の開始を待っています……</p>
              )}
              <button className="btn" style={{ color: "var(--danger)" }} onClick={leaveRoyale}>
                {confirmingLeave ? "本当に? もう一度押す" : "退出する"}
              </button>
            </div>
          )}
        </div>
      )}

      {state.phase === "select" && (
        <div className="panel">
          <h3>バトルに使うキャラクターを選択してください</h3>
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
            {state.participants.filter((p) => p.characterSelected).length}/{state.participants.length} 人が選択済み
          </p>
          {isSpectator || me?.characterSelected ? (
            <p style={{ color: "var(--text-dim)" }}>他の参加者の選択を待っています……</p>
          ) : (
            <CharacterPicker characters={historyData?.items ?? []} disabled={selecting} onSelect={selectCharacter} />
          )}
        </div>
      )}

      {state.phase === "round" && isSpectator && (
        <div className="panel">
          <p style={{ color: "var(--text-dim)" }}>参加者の行動を待っています……</p>
        </div>
      )}

      {state.phase === "round" && !isSpectator && me?.fighter && (
        <div className="panel">
          {me.fighter.hp <= 0 ? (
            <p style={{ color: "var(--text-dim)" }}>💀 脱落済みです。他の参加者の行動を待っています……</p>
          ) : me.actionSubmitted ? (
            <p style={{ color: "var(--text-dim)" }}>✅ 行動を選択しました。他の参加者の行動を待っています……</p>
          ) : pendingTargetAction ? (
            <>
              <h3>🎯 対象を選んでください</h3>
              <div className="result-grid">
                {aliveOpponents.map((op) => (
                  <button
                    key={op.userId}
                    className="card"
                    style={{ cursor: "pointer", textAlign: "left" }}
                    disabled={submitting}
                    onClick={() => submitAction({ ...pendingTargetAction, targetId: op.userId })}
                  >
                    <div style={{ fontWeight: 700 }}>{op.displayName}</div>
                    <div style={{ color: "var(--text-dim)", fontSize: "0.82rem" }}>
                      HP {op.fighter!.hp}/{op.fighter!.maxHp}
                    </div>
                  </button>
                ))}
              </div>
              <button className="btn" style={{ marginTop: "0.6rem" }} onClick={() => setPendingTargetAction(null)}>
                やめる
              </button>
            </>
          ) : (
            <>
              <h3>行動を選択してください</h3>
              <div className="action-grid">
                <button className="action-btn" disabled={submitting} onClick={() => beginAction({ type: "attack" })}>
                  ⚔️ こうげき
                </button>
                <button className="action-btn" disabled={submitting} onClick={() => submitAction({ type: "defend" })}>
                  🛡️ ぼうぎょ
                </button>
                {me.fighter.hasSpecial && (
                  <button
                    className="action-btn"
                    disabled={submitting || me.fighter.specialCooldown > 0}
                    onClick={beginSpecial}
                  >
                    ✨ とくぎ{me.fighter.specialCooldown > 0 ? `(あと${me.fighter.specialCooldown}R)` : ""}
                  </button>
                )}
                {me.fighter.hasGamble && (
                  <button
                    className="action-btn"
                    disabled={submitting || me.fighter.gambleCooldown > 0}
                    onClick={() => beginAction({ type: "gamble" })}
                  >
                    💀 一か八か{me.fighter.gambleCooldown > 0 ? `(あと${me.fighter.gambleCooldown}R)` : ""}
                  </button>
                )}
                <button className="action-btn" disabled={submitting} onClick={() => setShowItemPicker((v) => !v)}>
                  🎒 アイテム
                </button>
                <button
                  className="action-btn"
                  style={{ color: "var(--danger)", borderColor: confirmingLeave ? "var(--danger)" : undefined }}
                  onClick={leaveRoyale}
                  onBlur={() => setConfirmingLeave(false)}
                >
                  {confirmingLeave ? "本当に? もう一度押す" : "🏳️ 離脱"}
                </button>
              </div>

              {showItemPicker && (
                <div className="result-grid" style={{ marginTop: "1rem" }}>
                  {inventoryData?.items.length ? (
                    inventoryData.items.map((item) => (
                      <button
                        key={item.itemKey}
                        className="card"
                        style={{ cursor: "pointer", textAlign: "left" }}
                        disabled={submitting}
                        onClick={() => beginItem(item.itemKey)}
                      >
                        <div style={{ fontWeight: 700 }}>
                          {item.emoji} {item.name} ×{item.quantity}
                        </div>
                        <div style={{ color: "var(--text-dim)", fontSize: "0.82rem" }}>{item.desc}</div>
                      </button>
                    ))
                  ) : (
                    <p style={{ color: "var(--text-dim)" }}>使えるアイテムがありません。</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {state.phase === "finished" && (
        <div className={`panel reveal-pop${state.winnerUserId === user.id ? " glow-ssr" : ""}`}>
          <h2>
            {state.winnerUserId
              ? `🏆 ${state.participants.find((p) => p.userId === state.winnerUserId)?.displayName ?? "優勝者"} の勝利!`
              : `💥 決着つかず…(${state.finishReason ?? ""})`}
          </h2>
          {!isSpectator && (
            <p>
              🎁 報酬: <strong>+{state.rewards[user.id] ?? 0}</strong> コイン
              {state.winnerUserId === user.id && " (👑優勝ボーナス込み)"}
            </p>
          )}
          {placements.length > 0 && (
            <div style={{ marginTop: "0.75rem" }}>
              <h3>📊 最終順位</h3>
              {placements.map((pid, i) => {
                const p = state.participants.find((pp) => pp.userId === pid);
                if (!p) return null;
                return (
                  <div key={pid}>
                    {i + 1}位: {i === 0 && "👑 "}
                    {p.displayName}
                  </div>
                );
              })}
            </div>
          )}
          <button className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={() => navigate("/battle/royale")}>
            バトルロイヤル一覧に戻る
          </button>
        </div>
      )}

      <div className="panel">
        <button type="button" className="btn" onClick={() => setChatOpen((v) => !v)}>
          💬 チャット{chatMessages.length > 0 && !chatOpen ? `(${chatMessages.length})` : ""}
        </button>
        {chatOpen && (
          <div style={{ marginTop: "0.6rem" }}>
            <div
              style={{
                maxHeight: "8rem",
                overflowY: "auto",
                background: "var(--bg-panel-raised)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "0.5rem 0.6rem",
                fontSize: "0.82rem",
              }}
            >
              {chatMessages.length === 0 ? (
                <span style={{ color: "var(--text-dim)" }}>まだメッセージはありません。</span>
              ) : (
                chatMessages.map((m, i) => (
                  <div key={i} style={{ marginBottom: "0.25rem" }}>
                    <strong>{m.displayName}</strong>: {m.text}
                  </div>
                ))
              )}
            </div>
            <form onSubmit={sendChat} className="btn-row" style={{ marginTop: "0.5rem" }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="メッセージを入力"
                maxLength={200}
                style={{
                  background: "var(--bg-panel-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.5rem 0.6rem",
                  color: "var(--text)",
                  flex: 1,
                }}
              />
              <button className="btn btn-primary" type="submit" disabled={!chatInput.trim()}>
                送信
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function RoyaleFighterPanel({
  participant,
  isSelf,
  winner,
  hpOverride,
  isActing,
}: {
  participant: RoyaleParticipantDTO;
  isSelf: boolean;
  winner: boolean;
  hpOverride?: number;
  isActing?: boolean;
}) {
  const f = participant.fighter;
  const displayHp = f ? (hpOverride ?? f.hp) : 0;
  const statusIcons: string[] = [];
  if (f) {
    if (f.poisonRounds > 0) statusIcons.push(`🕷️毒(${f.poisonRounds})`);
    if (f.atkDebuffRounds > 0) statusIcons.push(`📉攻撃低下(${f.atkDebuffRounds})`);
    if (f.invincibleRounds > 0) statusIcons.push(`🛡️無敵(${f.invincibleRounds})`);
  }

  return (
    <div className={`fighter-card fighter-card-flex${isSelf ? " is-self" : ""}${isActing ? " is-acting" : ""}`}>
      <div style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>
        {winner && "👑 "}
        {participant.displayName}
      </div>
      {f ? (
        <>
          <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
            <RarityTag rarity={f.rarity} /> Lv{f.level}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
            {f.nationality}
            {f.age}歳{f.gender} / 🎭{f.feature}
          </div>
          <div style={{ margin: "0.3rem 0 0.15rem" }}>
            {displayHp <= 0 ? (
              <span style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>💀 脱落</span>
            ) : (
              <FighterVitals hp={displayHp} maxHp={f.maxHp} />
            )}
          </div>
          <div style={{ fontSize: "0.75rem" }}>
            HP {Math.max(0, displayHp)}/{f.maxHp}
            {statusIcons.length > 0 && <span style={{ color: "var(--gold)" }}> ・ {statusIcons.join(" / ")}</span>}
          </div>
        </>
      ) : (
        <p style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>
          {participant.characterSelected ? "準備完了" : "キャラクター選択中……"}
        </p>
      )}
    </div>
  );
}
