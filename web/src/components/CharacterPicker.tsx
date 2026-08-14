import { RARITY_ORDER, Rarity } from "@identity-slot/game-core";
import { RarityTag } from "./RarityTag";

interface PickableCharacter {
  id: string;
  nationality: string;
  age: number;
  gender: string;
  feature: string;
  rarity: Rarity;
  level: number;
}

/** バトル/レイドのキャラクター選択画面共通。所持キャラクター全員を、レア度ランクの高い順にグループ分けして表示する。 */
export function CharacterPicker({
  characters,
  disabled,
  onSelect,
}: {
  characters: PickableCharacter[];
  disabled?: boolean;
  onSelect: (id: string) => void;
}) {
  if (characters.length === 0) {
    return <p style={{ color: "var(--text-dim)" }}>キャラクターがいません。ガチャで入手してください。</p>;
  }

  const groups = [...RARITY_ORDER]
    .reverse()
    .map((r) => ({ rarity: r, items: characters.filter((c) => c.rarity === r) }))
    .filter((g) => g.items.length > 0);

  return (
    <div>
      {groups.map((g) => (
        <div key={g.rarity} style={{ marginBottom: "0.9rem" }}>
          <RarityTag rarity={g.rarity} />{" "}
          <span style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>×{g.items.length}</span>
          <div className="result-grid" style={{ marginTop: "0.5rem" }}>
            {g.items.map((c) => (
              <button type="button" className="card" key={c.id} disabled={disabled} onClick={() => onSelect(c.id)}>
                <RarityTag rarity={c.rarity} /> Lv{c.level}
                <div>
                  {c.nationality}
                  {c.age}歳{c.gender}
                </div>
                <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>🎭{c.feature}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
