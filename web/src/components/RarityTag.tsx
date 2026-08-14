import { RARITIES, Rarity } from "@identity-slot/game-core";

export function RarityTag({ rarity }: { rarity: Rarity }) {
  const info = RARITIES[rarity];
  return (
    <span className="rarity-tag" style={{ background: info.color + "22", color: info.color, border: `1px solid ${info.color}` }}>
      {info.emoji} {rarity}
    </span>
  );
}
