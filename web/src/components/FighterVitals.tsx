import { useEffect, useRef, useState } from "react";
import { HpBar } from "./HpBar";

export function FighterVitals({ hp, maxHp }: { hp: number; maxHp: number }) {
  const prevHpRef = useRef(hp);
  const idRef = useRef(0);
  const [popup, setPopup] = useState<{ id: number; text: string; kind: "damage" | "heal" } | null>(null);

  useEffect(() => {
    const prev = prevHpRef.current;
    prevHpRef.current = hp;
    if (hp === prev) return;

    const delta = hp - prev;
    idRef.current += 1;
    const id = idRef.current;
    setPopup({ id, text: delta > 0 ? `+${delta}` : `${delta}`, kind: delta > 0 ? "heal" : "damage" });

    const t = setTimeout(() => {
      setPopup((p) => (p?.id === id ? null : p));
    }, 900);
    return () => clearTimeout(t);
  }, [hp]);

  return (
    <div style={{ position: "relative" }}>
      <div className={popup?.kind === "damage" ? "hp-bar-wrap flash-hit" : "hp-bar-wrap"}>
        <HpBar hp={hp} maxHp={maxHp} />
      </div>
      {popup && (
        <span key={popup.id} className={`dmg-popup ${popup.kind === "heal" ? "dmg-popup-heal" : "dmg-popup-damage"}`}>
          {popup.text}
        </span>
      )}
    </div>
  );
}
