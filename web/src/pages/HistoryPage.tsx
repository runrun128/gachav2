import { RARITY_ORDER, Rarity, SPECIAL_TYPES } from "@identity-slot/game-core";
import { useQuery } from "@tanstack/react-query";
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
  isExclusive: boolean;
  soldAt: string | null;
  createdAt: string;
}

interface HistoryResponse {
  items: CharacterRow[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 100;

async function fetchAllCharacters(): Promise<CharacterRow[]> {
  const all: CharacterRow[] = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await api.get<HistoryResponse>(`/history?page=${page}&pageSize=${PAGE_SIZE}`);
    all.push(...res.items);
    if (all.length >= res.total || res.items.length === 0) break;
    page += 1;
  }
  return all;
}

export function HistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["history-all"],
    queryFn: fetchAllCharacters,
  });

  const groups = [...RARITY_ORDER]
    .reverse()
    .map((r) => ({ rarity: r, items: (data ?? []).filter((c) => c.rarity === r) }))
    .filter((g) => g.items.length > 0);

  const total = data?.length ?? 0;

  return (
    <div className="panel">
      <h1>📖 図鑑</h1>
      <p style={{ color: "var(--text-dim)" }}>
        これまでにガチャで手に入れた全キャラクターのコレクションです(全{total}体)。
      </p>

      {isLoading && <p>読み込み中……</p>}
      {!isLoading && total === 0 && (
        <p style={{ color: "var(--text-dim)" }}>まだキャラクターがいません。ガチャを引いてみましょう。</p>
      )}

      {groups.map((g) => (
        <div key={g.rarity} style={{ marginTop: "1.2rem" }}>
          <RarityTag rarity={g.rarity} />{" "}
          <span style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>×{g.items.length}</span>
          <div className="result-grid" style={{ marginTop: "0.5rem" }}>
            {g.items.map((c) => (
              <div className="card" key={c.id} style={{ opacity: c.soldAt ? 0.55 : 1 }}>
                <RarityTag rarity={c.rarity} /> Lv{c.level}
                {c.isExclusive && (
                  <span style={{ color: "var(--gold)", fontSize: "0.8rem", marginLeft: "0.4rem" }}>👑運営限定</span>
                )}
                {c.soldAt && (
                  <span style={{ color: "var(--text-dim)", fontSize: "0.75rem", marginLeft: "0.4rem" }}>手放し済み</span>
                )}
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
        </div>
      ))}
    </div>
  );
}
