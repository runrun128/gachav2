import { ItemDef, Rarity, isCharacterSellable } from "@identity-slot/game-core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
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
  level: number;
  isExclusive: boolean;
}

interface InventoryRow extends ItemDef {
  itemKey: string;
  quantity: number;
}

interface ListingRow {
  id: string;
  sellerId: string;
  sellerDisplayName: string;
  kind: "character" | "item";
  price: number;
  createdAt: string;
  character: (CharacterRow & { id: string }) | null;
  itemKey: string | null;
  itemQuantity: number | null;
  item: ItemDef | null;
}

export function MarketPage() {
  const { user, refresh } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: listingsData } = useQuery({
    queryKey: ["market"],
    queryFn: () => api.get<{ listings: ListingRow[] }>("/market"),
    refetchInterval: 15_000,
  });

  const { data: charactersData } = useQuery({
    queryKey: ["market-characters"],
    queryFn: () => api.get<{ items: CharacterRow[] }>("/characters/mine"),
  });
  const { data: inventoryData } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => api.get<{ items: InventoryRow[] }>("/inventory"),
  });

  const [kind, setKind] = useState<"character" | "item">("character");
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [selectedItemKey, setSelectedItemKey] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [price, setPrice] = useState("1000");
  const [listing, setListing] = useState(false);

  const listedCharacterIds = new Set(
    (listingsData?.listings ?? []).filter((l) => l.sellerId === user?.id && l.character).map((l) => l.character!.id)
  );
  const sellableCharacters = (charactersData?.items ?? []).filter(
    (c) => isCharacterSellable(c.rarity, c.isExclusive) && !listedCharacterIds.has(c.id)
  );

  async function createListing(e: FormEvent) {
    e.preventDefault();
    setListing(true);
    setError(null);
    setMessage(null);
    try {
      if (kind === "character") {
        if (!selectedCharacterId) return;
        await api.post("/market/list", { kind: "character", characterId: selectedCharacterId, price: Number(price) });
      } else {
        if (!selectedItemKey) return;
        await api.post("/market/list", { kind: "item", itemKey: selectedItemKey, itemQuantity: Number(itemQuantity), price: Number(price) });
      }
      setSelectedCharacterId("");
      setSelectedItemKey("");
      setItemQuantity("1");
      setPrice("1000");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["market"] }),
        queryClient.invalidateQueries({ queryKey: ["market-characters"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      ]);
      setMessage("✅ 出品しました。");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "出品に失敗しました。");
    } finally {
      setListing(false);
    }
  }

  async function buy(listingItem: ListingRow) {
    setBusyId(listingItem.id);
    setError(null);
    setMessage(null);
    try {
      await api.post(`/market/${listingItem.id}/buy`);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["market"] }), refresh()]);
      setMessage("✅ 購入しました。");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "購入に失敗しました。");
    } finally {
      setBusyId(null);
    }
  }

  async function cancelListing(listingItem: ListingRow) {
    setBusyId(listingItem.id);
    setError(null);
    setMessage(null);
    try {
      await api.delete(`/market/${listingItem.id}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["market"] }),
        queryClient.invalidateQueries({ queryKey: ["market-characters"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      ]);
      setMessage("出品を取り消しました。");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "取り消しに失敗しました。");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="panel">
        <h1>🏪 マーケット</h1>
        <p style={{ color: "var(--text-dim)" }}>キャラクターやアイテムをコインで出品・購入できます。</p>
        {message && <p style={{ color: "var(--success)" }}>{message}</p>}
        {error && <p className="error-text">{error}</p>}
      </div>

      <form className="panel" onSubmit={createListing}>
        <h3>📤 出品する</h3>
        <div className="btn-row" style={{ alignItems: "center", marginBottom: "0.75rem" }}>
          <label className="btn-row" style={{ alignItems: "center", gap: "0.3rem" }}>
            <input type="radio" checked={kind === "character"} onChange={() => setKind("character")} />
            キャラクター
          </label>
          <label className="btn-row" style={{ alignItems: "center", gap: "0.3rem" }}>
            <input type="radio" checked={kind === "item"} onChange={() => setKind("item")} />
            アイテム
          </label>
        </div>

        {kind === "character" ? (
          <select
            value={selectedCharacterId}
            onChange={(e) => setSelectedCharacterId(e.target.value)}
            style={{
              background: "var(--bg-panel-raised)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.5rem 0.6rem",
              color: "var(--text)",
              width: "100%",
            }}
          >
            <option value="">キャラクターを選択</option>
            {sellableCharacters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.rarity} Lv{c.level} {c.nationality}
                {c.age}歳{c.gender}
              </option>
            ))}
          </select>
        ) : (
          <div className="btn-row" style={{ alignItems: "center" }}>
            <select
              value={selectedItemKey}
              onChange={(e) => setSelectedItemKey(e.target.value)}
              style={{
                background: "var(--bg-panel-raised)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "0.5rem 0.6rem",
                color: "var(--text)",
                flex: 1,
                minWidth: 160,
              }}
            >
              <option value="">アイテムを選択</option>
              {inventoryData?.items.map((i) => (
                <option key={i.itemKey} value={i.itemKey}>
                  {i.emoji} {i.name}(所持{i.quantity})
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={itemQuantity}
              onChange={(e) => setItemQuantity(e.target.value)}
              placeholder="個数"
              style={{
                background: "var(--bg-panel-raised)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "0.5rem 0.6rem",
                color: "var(--text)",
                width: 90,
              }}
            />
          </div>
        )}

        <div className="btn-row" style={{ alignItems: "center", marginTop: "0.6rem" }}>
          <input
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="価格"
            style={{
              background: "var(--bg-panel-raised)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.5rem 0.6rem",
              color: "var(--text)",
              width: 140,
            }}
          />
          <span style={{ color: "var(--text-dim)" }}>コイン</span>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={listing || (kind === "character" ? !selectedCharacterId : !selectedItemKey) || !price}
          >
            出品する
          </button>
        </div>
      </form>

      <div className="panel">
        <h3>🛒 出品一覧</h3>
        <div className="result-grid">
          {listingsData?.listings.map((l) => {
            const isMine = l.sellerId === user?.id;
            return (
              <div className="card" key={l.id}>
                {l.kind === "character" && l.character ? (
                  <>
                    <div style={{ fontWeight: 700 }}>
                      <RarityTag rarity={l.character.rarity} /> Lv{l.character.level}
                    </div>
                    <div style={{ color: "var(--text-dim)", fontSize: "0.82rem" }}>
                      {l.character.nationality}
                      {l.character.age}歳{l.character.gender} / 🎭{l.character.feature}
                    </div>
                  </>
                ) : l.item ? (
                  <div style={{ fontWeight: 700 }}>
                    {l.item.emoji} {l.item.name} ×{l.itemQuantity}
                  </div>
                ) : (
                  <div style={{ fontWeight: 700 }}>⚠️ {l.itemKey}(不明)</div>
                )}
                <div style={{ color: "var(--text-dim)", fontSize: "0.8rem", margin: "0.3rem 0" }}>
                  出品者: {l.sellerDisplayName}
                </div>
                <div style={{ color: "var(--gold)" }}>💰 {l.price} コイン</div>
                <div className="btn-row" style={{ marginTop: "0.5rem" }}>
                  {isMine ? (
                    <button className="btn" style={{ color: "var(--danger)" }} disabled={busyId === l.id} onClick={() => cancelListing(l)}>
                      出品を取り消す
                    </button>
                  ) : (
                    <button className="btn btn-primary" disabled={busyId === l.id} onClick={() => buy(l)}>
                      購入する
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {listingsData?.listings.length === 0 && <p style={{ color: "var(--text-dim)" }}>出品はまだありません。</p>}
        </div>
      </div>
    </div>
  );
}
