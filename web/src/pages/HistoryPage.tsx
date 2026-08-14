import { RARITY_ORDER, Rarity, SPECIAL_TYPES } from "@identity-slot/game-core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RarityTag } from "../components/RarityTag";
import { api } from "../lib/api";

interface CharacterRow {
  id: string;
  nationality: string;
  age: number;
  gender: string;
  feature: string;
  rarity: Rarity;
  secretFeature: string | null;
  specialType: keyof typeof SPECIAL_TYPES | null;
  level: number;
  createdAt: string;
}

interface HistoryResponse {
  items: CharacterRow[];
  total: number;
  page: number;
  pageSize: number;
}

export function HistoryPage() {
  const [rarity, setRarity] = useState<Rarity | "">("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["history", rarity, page],
    queryFn: () =>
      api.get<HistoryResponse>(
        `/history?page=${page}&pageSize=${pageSize}${rarity ? `&rarity=${rarity}` : ""}`
      ),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="panel">
      <h1>📜 FORTUNE HISTORY</h1>
      <div className="pill-row">
        <button
          className={"pill" + (rarity === "" ? " active" : "")}
          onClick={() => {
            setRarity("");
            setPage(1);
          }}
        >
          すべて
        </button>
        {RARITY_ORDER.map((r) => (
          <button
            key={r}
            className={"pill" + (rarity === r ? " active" : "")}
            onClick={() => {
              setRarity(r);
              setPage(1);
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {isLoading && <p>読み込み中……</p>}

      {data && (
        <>
          <div className="result-grid">
            {data.items.map((c) => (
              <div className="card" key={c.id}>
                <RarityTag rarity={c.rarity} /> Lv{c.level}
                <div>
                  {c.nationality}
                  {c.age}歳{c.gender}
                </div>
                <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>🎭{c.feature}</div>
                {c.secretFeature && (
                  <div style={{ color: "var(--gold)", fontSize: "0.85rem" }}>
                    🔓{c.secretFeature}
                    {c.specialType && ` (${SPECIAL_TYPES[c.specialType].emoji}${SPECIAL_TYPES[c.specialType].label})`}
                  </div>
                )}
              </div>
            ))}
          </div>
          {data.items.length === 0 && <p style={{ color: "var(--text-dim)" }}>該当するキャラクターがいません。</p>}
          <div className="btn-row" style={{ marginTop: "1rem", alignItems: "center" }}>
            <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← 前へ
            </button>
            <span>
              {page} / {totalPages} ページ(全{data.total}件)
            </span>
            <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              次へ →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
