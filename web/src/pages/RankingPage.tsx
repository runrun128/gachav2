import { Rarity } from "@identity-slot/game-core";
import { useQuery } from "@tanstack/react-query";
import { RarityTag } from "../components/RarityTag";
import { api } from "../lib/api";

interface RankingEntry {
  id: string;
  displayName: string;
  totalSpins: number;
  bestRarity: Rarity;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function RankingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["ranking"],
    queryFn: () => api.get<{ ranking: RankingEntry[] }>("/ranking"),
  });

  return (
    <div className="panel">
      <h1>🏆 FORTUNE RANKING</h1>
      {isLoading && <p>読み込み中……</p>}
      {data && (
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th>プレイヤー</th>
              <th>最高レア度</th>
              <th>総ガチャ回数</th>
            </tr>
          </thead>
          <tbody>
            {data.ranking.map((entry, i) => (
              <tr key={entry.id}>
                <td>{MEDALS[i] ?? `${i + 1}.`}</td>
                <td>{entry.displayName}</td>
                <td>
                  <RarityTag rarity={entry.bestRarity} />
                </td>
                <td>{entry.totalSpins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
