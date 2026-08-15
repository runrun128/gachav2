import {
  MAX_TRAIN_LEVEL,
  RARITY_ORDER,
  Rarity,
  SETSPECIAL_COST,
  SPECIAL_TYPES,
  SPECIAL_TYPE_ORDER,
  SpecialType,
  characterSellPrice,
  isCharacterSellable,
  isSecretFeatureRarity,
  trainCost,
} from "@identity-slot/game-core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RarityTag } from "../components/RarityTag";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth-context";

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
  isExclusive: boolean;
}

export function TrainPage() {
  const { refresh } = useAuth();
  const queryClient = useQueryClient();
  // キャラAとキャラBを交互に連打するとそれぞれのボタンが独立に有効になってしまい、
  // 実質的に同時に何件もリクエストを送れてしまうため、キャラ単位ではなく画面全体で1つだけbusyにする。
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, SpecialType>>({});
  const [confirmingSellId, setConfirmingSellId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["train-characters"],
    queryFn: () => api.get<{ items: CharacterRow[] }>("/characters/mine"),
  });

  const groups = [...RARITY_ORDER]
    .reverse()
    .map((r) => ({ rarity: r, items: (data?.items ?? []).filter((c) => c.rarity === r) }))
    .filter((g) => g.items.length > 0);

  async function train(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/characters/${id}/train`);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["train-characters"] }), refresh()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "育成に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function sell(id: string) {
    if (busy) return;
    if (confirmingSellId !== id) {
      setConfirmingSellId(id);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post(`/characters/${id}/sell`);
      setConfirmingSellId(null);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["train-characters"] }), refresh()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "売却に失敗しました。");
      setConfirmingSellId(null);
    } finally {
      setBusy(false);
    }
  }

  async function changeSpecial(id: string) {
    if (busy) return;
    const specialType = selected[id];
    if (!specialType) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/characters/${id}/special`, { specialType });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["train-characters"] }), refresh()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "とくぎ変更に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h1>💪 キャラ育成</h1>
      <p style={{ color: "var(--text-dim)" }}>
        育成でステータス強化(最大Lv{MAX_TRAIN_LEVEL})。SSR以上は{SETSPECIAL_COST}コインでとくぎ属性を変更できます。
      </p>
      {error && <p className="error-text">{error}</p>}
      {isLoading && <p>読み込み中……</p>}

      {!isLoading && groups.length === 0 && (
        <p style={{ color: "var(--text-dim)" }}>キャラクターがいません。ガチャで入手してください。</p>
      )}

      {groups.map((g) => (
        <div key={g.rarity} style={{ marginBottom: "1rem" }}>
          <RarityTag rarity={g.rarity} />{" "}
          <span style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>×{g.items.length}</span>
          <div className="result-grid" style={{ marginTop: "0.5rem" }}>
            {g.items.map((c) => (
              <div className="card" key={c.id}>
                <RarityTag rarity={c.rarity} /> Lv{c.level}
                {c.isExclusive && (
                  <span style={{ color: "var(--gold)", fontSize: "0.8rem", marginLeft: "0.4rem" }}>👑運営限定</span>
                )}
                <div>
                  {c.nationality}
                  {c.age}歳{c.gender}
                </div>
                <div className="btn-row" style={{ marginTop: "0.6rem" }}>
                  <button className="btn" disabled={busy || c.level >= MAX_TRAIN_LEVEL} onClick={() => train(c.id)}>
                    {c.level >= MAX_TRAIN_LEVEL ? "最大レベル" : `育成(${trainCost(c.level)}コイン)`}
                  </button>
                  {isCharacterSellable(c.rarity, c.isExclusive) && (
                    <button
                      className="btn"
                      style={{ color: "var(--danger)" }}
                      disabled={busy}
                      onClick={() => sell(c.id)}
                    >
                      {confirmingSellId === c.id
                        ? "本当に売却しますか?もう一度押す"
                        : `売却(💰${characterSellPrice(c.rarity, c.level)})`}
                    </button>
                  )}
                </div>

                {isSecretFeatureRarity(c.rarity) &&
                  (() => {
                    const currentSelection = selected[c.id] ?? c.specialType ?? SPECIAL_TYPE_ORDER[0];
                    const isSameAsCurrent = currentSelection === c.specialType;
                    return (
                      <div className="btn-row" style={{ marginTop: "0.5rem" }}>
                        <select
                          value={currentSelection}
                          onChange={(e) => setSelected((s) => ({ ...s, [c.id]: e.target.value as SpecialType }))}
                        >
                          {SPECIAL_TYPE_ORDER.map((t) => (
                            <option key={t} value={t}>
                              {SPECIAL_TYPES[t].emoji} {SPECIAL_TYPES[t].label}
                              {t === c.specialType ? "(現在)" : ""}
                            </option>
                          ))}
                        </select>
                        <button className="btn" disabled={busy || isSameAsCurrent} onClick={() => changeSpecial(c.id)}>
                          {isSameAsCurrent ? "現在の属性です" : `変更(${SETSPECIAL_COST})`}
                        </button>
                      </div>
                    );
                  })()}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
