import { BossKey, ItemDef, Rarity, SPECIAL_TYPES, SpecialType } from "@identity-slot/game-core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BattleLog } from "../components/BattleLog";
import { FighterVitals } from "../components/FighterVitals";
import { RarityTag } from "../components/RarityTag";
import { useRoundReplay } from "../hooks/useRoundReplay";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useSocket } from "../lib/socket-context";

interface RaidRoundStepDTO {
  upToLine: number;
  participantHp: Record<string, number>;
  bossHp: number;
}

interface RaidFighterDTO {
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
  frozen: boolean;
  burnRounds: number;
  poisonRounds: number;
  silencedRounds: number;
  atkDebuffRounds: number;
}

interface RaidParticipantDTO {
  userId: string;
  displayName: string;
  characterSelected: boolean;
  actionSubmitted: boolean;
  fighter: RaidFighterDTO | null;
}

interface RaidStateDTO {
  roomId: string;
  roomName: string;
  bossKey: BossKey;
  bossName: string;
  bossEmoji: string;
  bossDesc: string;
  hostUserId: string;
  phase: "lobby" | "select" | "round" | "finished";
  roundNo: number;
  log: string[];
  roundSteps: RaidRoundStepDTO[];
  winner: boolean | null;
  finishReason: string | null;
  rewards: Record<string, number>;
  drops: Record<string, { itemKey: string; name: string; emoji: string }>;
  mvpUserId: string | null;
  damageDealt: Record<string, number>;
  maxParticipants: number;
  boss: { hp: number; maxHp: number; shieldRounds: number; weakPoint: boolean } | null;
  participants: RaidParticipantDTO[];
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

export function RaidRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { socket } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<RaidStateDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: historyData } = useQuery({
    queryKey: ["raid-characters"],
    queryFn: () => api.get<{ items: CharacterRow[] }>("/history?pageSize=100"),
    enabled: state?.phase === "select",
  });

  const { data: inventoryData } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => api.get<{ items: (ItemDef & { itemKey: string; quantity: number })[] }>("/inventory"),
    enabled: state?.phase === "round",
  });

  useEffect(() => {
    if (!socket || !roomId) return;

    function onState(payload: RaidStateDTO) {
      if (payload.roomId === roomId) {
        setState(payload);
        setError(null);
        setShowItemPicker(false);
        setConfirmingLeave(false);
        setSelecting(false);
        setSubmitting(false);
      }
    }
    socket.on("raid:state", onState);
    socket.emit("raid:joinRoom", { roomId }, (res: AckResponse) => {
      if (!res.ok) setError(res.error ?? "レイドへの参加に失敗しました。");
    });

    return () => {
      socket.off("raid:state", onState);
    };
  }, [socket, roomId]);

  const { visibleLogCount, previousLogCount, activeStep } = useRoundReplay(state?.log.length ?? 0, state?.roundSteps);

  if (error) {
    return (
      <div className="panel">
        <p className="error-text">{error}</p>
        <button className="btn" onClick={() => navigate("/raid")}>
          レイド一覧に戻る
        </button>
      </div>
    );
  }

  if (!state || !user) {
    return <p>読み込み中……</p>;
  }

  const me = state.participants.find((p) => p.userId === user.id);
  const isHost = state.hostUserId === user.id;

  function selectCharacter(characterId: string) {
    if (selecting) return;
    setSelecting(true);
    socket?.emit("raid:selectCharacter", { roomId, characterId }, (res: AckResponse) => {
      if (!res.ok && res.error !== "すでに選択済みです。") {
        setSelecting(false);
        setError(res.error ?? "選択に失敗しました。");
      }
    });
  }

  function submitAction(action: { type: string; itemKey?: string }) {
    if (submitting) return;
    setSubmitting(true);
    socket?.emit("raid:action", { roomId, action }, (res: AckResponse) => {
      if (!res.ok && res.error !== "すでに行動を選択済みです。") {
        setSubmitting(false);
        setError(res.error ?? "行動の送信に失敗しました。");
      }
    });
  }

  function startRaid() {
    socket?.emit("raid:start", { roomId }, (res: AckResponse) => {
      if (!res.ok) setError(res.error ?? "開始に失敗しました。");
    });
  }

  function leaveRaid() {
    if (!confirmingLeave) {
      setConfirmingLeave(true);
      return;
    }
    setConfirmingLeave(false);
    socket?.emit("raid:leave", { roomId }, () => navigate("/raid"));
  }

  return (
    <div>
      <div className="panel">
        <h1>
          {state.bossEmoji} {state.roomName}
        </h1>
        <p style={{ color: "var(--text-dim)" }}>
          {state.bossEmoji} {state.bossName}
          {state.phase === "round" && ` — ラウンド ${state.roundNo}`}
        </p>

        {state.phase !== "lobby" && (
          <BattleLog log={state.log} visibleLogCount={visibleLogCount} previousLogCount={previousLogCount} />
        )}

        {state.boss && (
          <div style={{ marginTop: "0.75rem" }}>
            <div className="btn-row" style={{ alignItems: "center", marginBottom: "0.3rem" }}>
              <strong>{state.bossName}</strong>
              {state.boss.weakPoint && <span className="pill active">🌟 隙が生まれている!与ダメ1.5倍</span>}
              {state.boss.shieldRounds > 0 && <span className="pill">🌪️ 暴風の盾(あと{state.boss.shieldRounds}R)</span>}
            </div>
            <FighterVitals hp={activeStep?.bossHp ?? state.boss.hp} maxHp={state.boss.maxHp} />
            <div style={{ fontSize: "0.85rem", marginTop: "0.2rem" }}>
              HP {activeStep?.bossHp ?? state.boss.hp}/{state.boss.maxHp}
            </div>
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
          <div className="btn-row" style={{ marginTop: "1rem" }}>
            {isHost ? (
              <button className="btn btn-primary" onClick={startRaid}>
                ▶️ レイド開始
              </button>
            ) : (
              <p style={{ color: "var(--text-dim)" }}>主催者の開始を待っています……</p>
            )}
            <button className="btn" style={{ color: "var(--danger)" }} onClick={leaveRaid}>
              {confirmingLeave ? "本当に? もう一度押す" : "退出する"}
            </button>
          </div>
        </div>
      )}

      {state.phase === "select" && (
        <div className="panel">
          <h3>バトルに使うキャラクターを選択してください</h3>
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
            {state.participants.filter((p) => p.characterSelected).length}/{state.participants.length} 人が選択済み
          </p>
          {me?.characterSelected ? (
            <p style={{ color: "var(--text-dim)" }}>他の参加者の選択を待っています……</p>
          ) : (
            <div className="result-grid">
              {historyData?.items.map((c) => (
                <button
                  type="button"
                  className="card"
                  key={c.id}
                  disabled={selecting}
                  onClick={() => selectCharacter(c.id)}
                >
                  <RarityTag rarity={c.rarity} /> Lv{c.level}
                  <div>
                    {c.nationality}
                    {c.age}歳{c.gender}
                  </div>
                  <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>🎭{c.feature}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {(state.phase === "round" || state.phase === "finished") && (
        <div className="panel">
          <h3>参加者</h3>
          <div className="btn-row" style={{ alignItems: "stretch", flexWrap: "wrap" }}>
            {state.participants.map((p) => (
              <RaidFighterPanel
                key={p.userId}
                participant={p}
                isSelf={p.userId === user.id}
                mvp={p.userId === state.mvpUserId}
                hpOverride={activeStep?.participantHp[p.userId]}
              />
            ))}
          </div>
        </div>
      )}

      {state.phase === "round" && me?.fighter && (
        <div className="panel">
          {me.fighter.hp <= 0 ? (
            <p style={{ color: "var(--text-dim)" }}>💀 戦闘不能です。他の参加者の行動を待っています……</p>
          ) : me.fighter.frozen ? (
            <p style={{ color: "var(--text-dim)" }}>🧊 凍結中です。このラウンドは動けません……</p>
          ) : me.actionSubmitted ? (
            <p style={{ color: "var(--text-dim)" }}>✅ 行動を選択しました。他の参加者の行動を待っています……</p>
          ) : (
            <>
              <h3>行動を選択してください</h3>
              <div className="action-grid">
                <button className="action-btn" disabled={submitting} onClick={() => submitAction({ type: "attack" })}>
                  ⚔️ こうげき
                </button>
                <button className="action-btn" disabled={submitting} onClick={() => submitAction({ type: "defend" })}>
                  🛡️ ぼうぎょ
                </button>
                {me.fighter.hasSpecial && (
                  <button
                    className="action-btn"
                    disabled={submitting || me.fighter.specialCooldown > 0 || me.fighter.silencedRounds > 0}
                    onClick={() => submitAction({ type: "special" })}
                  >
                    ✨ とくぎ
                    {me.fighter.silencedRounds > 0
                      ? "(封印中)"
                      : me.fighter.specialCooldown > 0
                        ? `(あと${me.fighter.specialCooldown}R)`
                        : ""}
                  </button>
                )}
                {me.fighter.hasGamble && (
                  <button
                    className="action-btn"
                    disabled={submitting || me.fighter.gambleCooldown > 0 || me.fighter.silencedRounds > 0}
                    onClick={() => submitAction({ type: "gamble" })}
                  >
                    💀 一か八か
                    {me.fighter.silencedRounds > 0
                      ? "(封印中)"
                      : me.fighter.gambleCooldown > 0
                        ? `(あと${me.fighter.gambleCooldown}R)`
                        : ""}
                  </button>
                )}
                <button className="action-btn" disabled={submitting} onClick={() => setShowItemPicker((v) => !v)}>
                  🎒 アイテム
                </button>
                <button
                  className="action-btn"
                  style={{ color: "var(--danger)", borderColor: confirmingLeave ? "var(--danger)" : undefined }}
                  onClick={leaveRaid}
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
                        onClick={() => submitAction({ type: "item", itemKey: item.itemKey })}
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
        <div className={`panel reveal-pop${state.winner ? " glow-ssr" : ""}`}>
          <h2>{state.winner ? "🏆 討伐成功!" : `💀 討伐失敗…(${state.finishReason ?? ""})`}</h2>
          <p>
            🎁 報酬: <strong>+{state.rewards[user.id] ?? 0}</strong> コイン
            {state.mvpUserId === user.id && " (👑MVPボーナス込み)"}
          </p>
          {state.drops[user.id] && (
            <p>
              🎁 ドロップ: {state.drops[user.id].emoji} {state.drops[user.id].name}
            </p>
          )}
          {Object.keys(state.damageDealt).length > 0 && (
            <div style={{ marginTop: "0.75rem" }}>
              <h3>📊 与ダメージ内訳</h3>
              {state.participants
                .slice()
                .sort((a, b) => (state.damageDealt[b.userId] ?? 0) - (state.damageDealt[a.userId] ?? 0))
                .map((p) => (
                  <div key={p.userId}>
                    {p.userId === state.mvpUserId && "👑 "}
                    {p.displayName}: {state.damageDealt[p.userId] ?? 0} ダメージ
                  </div>
                ))}
            </div>
          )}
          <button className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={() => navigate("/raid")}>
            レイド一覧に戻る
          </button>
        </div>
      )}
    </div>
  );
}

function RaidFighterPanel({
  participant,
  isSelf,
  mvp,
  hpOverride,
}: {
  participant: RaidParticipantDTO;
  isSelf: boolean;
  mvp: boolean;
  hpOverride?: number;
}) {
  const f = participant.fighter;
  const displayHp = f ? (hpOverride ?? f.hp) : 0;
  const statusIcons: string[] = [];
  if (f) {
    if (f.frozen) statusIcons.push("🧊凍結");
    if (f.burnRounds > 0) statusIcons.push(`🔥火傷(${f.burnRounds})`);
    if (f.poisonRounds > 0) statusIcons.push(`🕷️毒(${f.poisonRounds})`);
    if (f.silencedRounds > 0) statusIcons.push(`🔇封印(${f.silencedRounds})`);
    if (f.atkDebuffRounds > 0) statusIcons.push(`📉攻撃低下(${f.atkDebuffRounds})`);
  }

  return (
    <div className={`fighter-card fighter-card-flex${isSelf ? " is-self" : ""}`}>
      <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
        {mvp && "👑 "}
        {participant.displayName}
      </div>
      {f ? (
        <>
          <div style={{ fontWeight: 700 }}>
            <RarityTag rarity={f.rarity} /> Lv{f.level}
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
            {f.nationality}
            {f.age}歳{f.gender} / 🎭{f.feature}
          </div>
          <div style={{ margin: "0.5rem 0 0.25rem" }}>
            {displayHp <= 0 ? (
              <span style={{ color: "var(--text-dim)" }}>💀 戦闘不能</span>
            ) : (
              <FighterVitals hp={displayHp} maxHp={f.maxHp} />
            )}
          </div>
          <div style={{ fontSize: "0.85rem" }}>
            HP {Math.max(0, displayHp)}/{f.maxHp}
          </div>
          {statusIcons.length > 0 && (
            <div style={{ fontSize: "0.78rem", color: "var(--gold)" }}>{statusIcons.join(" / ")}</div>
          )}
        </>
      ) : (
        <p style={{ color: "var(--text-dim)" }}>{participant.characterSelected ? "準備完了" : "キャラクター選択中……"}</p>
      )}
    </div>
  );
}
