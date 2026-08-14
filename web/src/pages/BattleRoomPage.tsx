import { ItemDef, Rarity, SPECIAL_TYPES, SpecialType } from "@identity-slot/game-core";
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

interface RoundStepDTO {
  upToLine: number;
  hp: Record<string, number>;
}

interface FighterDTO {
  displayName: string;
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
}

interface PlayerDTO {
  userId: string;
  characterSelected: boolean;
  actionSubmitted: boolean;
  fighter: FighterDTO | null;
}

interface BattleStateDTO {
  roomId: string;
  phase: "select" | "round" | "finished";
  roundNo: number;
  settings: { maxRounds: number; itemsAllowed: boolean };
  log: string[];
  roundSteps: RoundStepDTO[];
  winnerUserId: string | "draw" | null;
  rewards: Record<string, number>;
  players: PlayerDTO[];
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

export function BattleRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { socket } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<BattleStateDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [confirmingRetire, setConfirmingRetire] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: historyData } = useQuery({
    queryKey: ["battle-characters"],
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

    function onState(payload: BattleStateDTO) {
      if (payload.roomId === roomId) {
        setState(payload);
        setError(null);
        setShowItemPicker(false);
        setConfirmingRetire(false);
        setSelecting(false);
        setSubmitting(false);
      }
    }
    socket.on("battle:state", onState);
    socket.emit("battle:joinRoom", { roomId }, (res: AckResponse) => {
      if (!res.ok) setError(res.error ?? "バトルへの参加に失敗しました。");
    });

    return () => {
      socket.off("battle:state", onState);
    };
  }, [socket, roomId]);

  const { visibleLogCount, previousLogCount, activeStep } = useRoundReplay(state?.log.length ?? 0, state?.roundSteps);

  if (error) {
    return (
      <div className="panel">
        <p className="error-text">{error}</p>
        <button className="btn" onClick={() => navigate("/battle")}>
          ロビーに戻る
        </button>
      </div>
    );
  }

  if (!state || !user) {
    return <p>読み込み中……</p>;
  }

  const me = state.players.find((p) => p.userId === user.id);
  const opponent = state.players.find((p) => p.userId !== user.id);

  if (!me || !opponent) {
    return <p>読み込み中……</p>;
  }

  function selectCharacter(characterId: string) {
    if (selecting) return;
    setSelecting(true);
    socket?.emit("battle:selectCharacter", { roomId, characterId }, (res: AckResponse) => {
      // 「すでに選択済みです」は直前の送信が既に成功している合図なので、次のstate配信を待つだけでよい
      if (!res.ok && res.error !== "すでに選択済みです。") {
        setSelecting(false);
        setError(res.error ?? "選択に失敗しました。");
      }
    });
  }

  function submitAction(action: { type: string; itemKey?: string }) {
    if (submitting) return;
    setSubmitting(true);
    socket?.emit("battle:action", { roomId, action }, (res: AckResponse) => {
      if (!res.ok && res.error !== "すでに行動を選択済みです。") {
        setSubmitting(false);
        setError(res.error ?? "行動の送信に失敗しました。");
      }
    });
  }

  function retire() {
    if (!confirmingRetire) {
      setConfirmingRetire(true);
      return;
    }
    setConfirmingRetire(false);
    socket?.emit("battle:retire", { roomId }, () => {});
  }

  return (
    <div className="battle-compact">
      <div className="panel">
        <h1>⚔️ IDENTITY BATTLE</h1>
        {state.phase === "round" && (
          <p style={{ color: "var(--text-dim)" }}>
            ラウンド {state.roundNo} / {state.settings.maxRounds}
            {!state.settings.itemsAllowed && " ・ アイテム禁止"}
          </p>
        )}
        <BattleLog log={state.log} visibleLogCount={visibleLogCount} previousLogCount={previousLogCount} />

        <div className="btn-row" style={{ alignItems: "stretch", marginTop: "0.75rem" }}>
          <FighterPanel label="あなた" player={me} isSelf hpOverride={activeStep?.hp[me.userId]} />
          <FighterPanel label="相手" player={opponent} isSelf={false} hpOverride={activeStep?.hp[opponent.userId]} />
        </div>
      </div>

      {state.phase === "select" && (
        <div className="panel">
          <h3>バトルに使うキャラクターを選択してください</h3>
          {me.characterSelected ? (
            <p style={{ color: "var(--text-dim)" }}>相手の選択を待っています……</p>
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

      {state.phase === "round" && (
        <div className="panel">
          {me.actionSubmitted ? (
            <p style={{ color: "var(--text-dim)" }}>✅ 行動を選択しました。相手の行動を待っています……</p>
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
                {me.fighter!.hasSpecial && (
                  <button
                    className="action-btn"
                    disabled={submitting || me.fighter!.specialCooldown > 0}
                    onClick={() => submitAction({ type: "special" })}
                  >
                    ✨ とくぎ{me.fighter!.specialCooldown > 0 ? `(あと${me.fighter!.specialCooldown}R)` : ""}
                  </button>
                )}
                {me.fighter!.hasGamble && (
                  <button
                    className="action-btn"
                    disabled={submitting || me.fighter!.gambleCooldown > 0}
                    onClick={() => submitAction({ type: "gamble" })}
                  >
                    💀 一か八か{me.fighter!.gambleCooldown > 0 ? `(あと${me.fighter!.gambleCooldown}R)` : ""}
                  </button>
                )}
                {state.settings.itemsAllowed && (
                  <button className="action-btn" disabled={submitting} onClick={() => setShowItemPicker((v) => !v)}>
                    🎒 アイテム
                  </button>
                )}
                <button
                  className="action-btn"
                  style={{ color: "var(--danger)", borderColor: confirmingRetire ? "var(--danger)" : undefined }}
                  onClick={retire}
                  onBlur={() => setConfirmingRetire(false)}
                >
                  {confirmingRetire ? "本当に? もう一度押す" : "🏳️ リタイア"}
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
        <div className={`panel reveal-pop${state.winnerUserId === user.id ? " glow-ssr" : ""}`}>
          <h2>
            {state.winnerUserId === "draw"
              ? "💥 DRAW!"
              : state.winnerUserId === user.id
                ? "🏆 あなたの勝利!"
                : "敗北……"}
          </h2>
          <p>
            🎁 報酬: <strong>+{state.rewards[user.id] ?? 0}</strong> コイン
          </p>
          <button className="btn btn-primary" onClick={() => navigate("/battle")}>
            ロビーに戻る
          </button>
        </div>
      )}
    </div>
  );
}

function FighterPanel({
  label,
  player,
  isSelf,
  hpOverride,
}: {
  label: string;
  player: PlayerDTO;
  isSelf: boolean;
  hpOverride?: number;
}) {
  const f = player.fighter;
  const displayHp = f ? (hpOverride ?? f.hp) : 0;
  return (
    <div className={`fighter-card fighter-card-flex${isSelf ? " is-self" : ""}`}>
      <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>{label}</div>
      {f ? (
        <>
          <div style={{ fontWeight: 700 }}>
            <RarityTag rarity={f.rarity} /> Lv{f.level} {f.displayName}
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
            {f.nationality}
            {f.age}歳{f.gender} / 🎭{f.feature}
          </div>
          <div style={{ margin: "0.5rem 0 0.25rem" }}>
            <FighterVitals hp={displayHp} maxHp={f.maxHp} />
          </div>
          <div style={{ fontSize: "0.85rem" }}>
            HP {displayHp}/{f.maxHp} ・ ATK {f.atk} ・ DEF {f.def} ・ SPD {f.spd}
          </div>
          {f.hasSpecial && f.specialType && (
            <div style={{ fontSize: "0.8rem", color: "var(--gold)" }}>
              {SPECIAL_TYPES[f.specialType].emoji}
              {SPECIAL_TYPES[f.specialType].label}「{f.moveName}」
            </div>
          )}
        </>
      ) : (
        <p style={{ color: "var(--text-dim)" }}>{player.characterSelected ? "準備完了" : "キャラクター選択中……"}</p>
      )}
    </div>
  );
}
