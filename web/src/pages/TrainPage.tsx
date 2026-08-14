import {
  MAX_TRAIN_LEVEL,
  Rarity,
  SETSPECIAL_COST,
  SPECIAL_TYPES,
  SPECIAL_TYPE_ORDER,
  SpecialType,
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
}

export function TrainPage() {
  const { refresh } = useAuth();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, SpecialType>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["train-characters"],
    queryFn: () => api.get<{ items: CharacterRow[] }>("/history?pageSize=100"),
  });

  async function train(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/characters/${id}/train`);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["train-characters"] }), refresh()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "育成に失敗しました。");
    } finally {
      setBusyId(null);
    }
  }

  async function changeSpecial(id: string) {
    const specialType = selected[id];
    if (!specialType) return;
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/characters/${id}/special`, { specialType });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["train-characters"] }), refresh()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "とくぎ変更に失敗しました。");
    } finally {
      setBusyId(null);
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

      <div className="result-grid">
        {data?.items.map((c) => (
          <div className="card" key={c.id}>
            <RarityTag rarity={c.rarity} /> Lv{c.level}
            <div>
              {c.nationality}
              {c.age}歳{c.gender}
            </div>
            <div className="btn-row" style={{ marginTop: "0.6rem" }}>
              <button
                className="btn"
                disabled={busyId === c.id || c.level >= MAX_TRAIN_LEVEL}
                onClick={() => train(c.id)}
              >
                {c.level >= MAX_TRAIN_LEVEL ? "最大レベル" : `育成(${trainCost(c.level)}コイン)`}
              </button>
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
                    <button
                      className="btn"
                      disabled={busyId === c.id || isSameAsCurrent}
                      onClick={() => changeSpecial(c.id)}
                    >
                      {isSameAsCurrent ? "現在の属性です" : `変更(${SETSPECIAL_COST})`}
                    </button>
                  </div>
                );
              })()}
          </div>
        ))}
      </div>
    </div>
  );
}
