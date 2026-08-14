import { ItemDef } from "@identity-slot/game-core";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function InventoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => api.get<{ items: (ItemDef & { itemKey: string; quantity: number })[] }>("/inventory"),
  });

  return (
    <div className="panel">
      <h1>🎒 INVENTORY</h1>
      {isLoading && <p>読み込み中……</p>}
      {data && data.items.length === 0 && (
        <p style={{ color: "var(--text-dim)" }}>所持アイテムはありません。ショップで購入できます。</p>
      )}
      <div className="result-grid">
        {data?.items.map((item) => (
          <div className="card" key={item.itemKey}>
            <div style={{ fontWeight: 700 }}>
              {item.emoji} {item.name} ×{item.quantity}
            </div>
            <div style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginTop: "0.4rem" }}>{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
