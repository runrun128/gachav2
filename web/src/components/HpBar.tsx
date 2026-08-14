export function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = maxHp <= 0 ? 0 : Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const cls = pct <= 25 ? "low" : pct <= 55 ? "mid" : "";
  return (
    <div className="hp-bar-track">
      <div className={`hp-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
