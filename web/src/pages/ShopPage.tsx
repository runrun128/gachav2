import { ItemDef, ItemTier, RARITIES, Rarity, characterSellPrice, isCharacterSellable } from "@identity-slot/game-core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { RarityTag } from "../components/RarityTag";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { TIER_COLOR, accentStyle } from "../lib/itemDisplay";

const ITEM_TIER_ORDER: ItemTier[] = ["shop", "common", "uncommon", "rare", "legendary"];

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

const inputStyle = {
  background: "var(--bg-panel-raised)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "0.5rem 0.6rem",
  color: "var(--text)",
};

export function ShopPage() {
  const { user, refresh } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"shop" | "market">("shop");

  // ===== 公式ショップ =====
  const { data: shopData, isLoading: shopLoading } = useQuery({
    queryKey: ["shop"],
    queryFn: () => api.get<{ items: ItemDef[] }>("/shop"),
  });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [shopMessage, setShopMessage] = useState<string | null>(null);

  async function buy(itemKey: string) {
    setBusyKey(itemKey);
    setShopMessage(null);
    try {
      await api.post("/shop/buy", { itemKey, amount: 1 });
      await refresh();
      setShopMessage("✅ 購入しました。");
    } catch (err) {
      setShopMessage(err instanceof ApiError ? err.message : "購入に失敗しました。");
    } finally {
      setBusyKey(null);
    }
  }

  const shopGroups = ITEM_TIER_ORDER.map((tier) => ({
    tier,
    items: (shopData?.items ?? []).filter((i) => i.tier === tier),
  })).filter((g) => g.items.length > 0);

  // ===== マーケット =====
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

  const [marketMessage, setMarketMessage] = useState<string | null>(null);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [busyListingId, setBusyListingId] = useState<string | null>(null);

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
  const selectedCharacter = sellableCharacters.find((c) => c.id === selectedCharacterId);
  const referenceSellPrice = selectedCharacter
    ? characterSellPrice(selectedCharacter.rarity, selectedCharacter.level)
    : null;

  async function createListing(e: FormEvent) {
    e.preventDefault();
    setListing(true);
    setMarketError(null);
    setMarketMessage(null);
    try {
      if (kind === "character") {
        if (!selectedCharacterId) return;
        await api.post("/market/list", { kind: "character", characterId: selectedCharacterId, price: Number(price) });
      } else {
        if (!selectedItemKey) return;
        await api.post("/market/list", {
          kind: "item",
          itemKey: selectedItemKey,
          itemQuantity: Number(itemQuantity),
          price: Number(price),
        });
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
      setMarketMessage("✅ 出品しました。");
    } catch (err) {
      setMarketError(err instanceof ApiError ? err.message : "出品に失敗しました。");
    } finally {
      setListing(false);
    }
  }

  async function buyListing(listingItem: ListingRow) {
    setBusyListingId(listingItem.id);
    setMarketError(null);
    setMarketMessage(null);
    try {
      await api.post(`/market/${listingItem.id}/buy`);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["market"] }), refresh()]);
      setMarketMessage("✅ 購入しました。");
    } catch (err) {
      setMarketError(err instanceof ApiError ? err.message : "購入に失敗しました。");
    } finally {
      setBusyListingId(null);
    }
  }

  async function cancelListing(listingItem: ListingRow) {
    setBusyListingId(listingItem.id);
    setMarketError(null);
    setMarketMessage(null);
    try {
      await api.delete(`/market/${listingItem.id}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["market"] }),
        queryClient.invalidateQueries({ queryKey: ["market-characters"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      ]);
      setMarketMessage("出品を取り消しました。");
    } catch (err) {
      setMarketError(err instanceof ApiError ? err.message : "取り消しに失敗しました。");
    } finally {
      setBusyListingId(null);
    }
  }

  const characterListings = (listingsData?.listings ?? []).filter((l) => l.kind === "character");
  const itemListings = (listingsData?.listings ?? []).filter((l) => l.kind === "item");

  return (
    <div>
      <div className="panel">
        <h1>🛒 ショップ</h1>
        <div className="pill-row">
          <button type="button" className={"pill" + (tab === "shop" ? " active" : "")} onClick={() => setTab("shop")}>
            🛒 公式ショップ
          </button>
          <button type="button" className={"pill" + (tab === "market" ? " active" : "")} onClick={() => setTab("market")}>
            🏪 マーケット
          </button>
        </div>
      </div>

      {tab === "shop" ? (
        <div className="panel">
          {shopMessage && <p style={{ color: "var(--success)" }}>{shopMessage}</p>}
          {shopLoading && <p>読み込み中……</p>}
          {shopGroups.map((g) => (
            <div key={g.tier} style={{ marginTop: "1.2rem" }}>
              <h4 className="shop-section-title" style={accentStyle(TIER_COLOR[g.tier])}>
                {g.tier}
              </h4>
              <div className="result-grid">
                {g.items.map((item) => (
                  <div className="shop-card" style={accentStyle(TIER_COLOR[g.tier])} key={item.key}>
                    <span className="shop-tier-badge">{g.tier}</span>
                    <div className="shop-card-icon">{item.emoji}</div>
                    <div className="shop-card-name">{item.name}</div>
                    <div className="shop-card-desc">{item.desc}</div>
                    <div className="btn-row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                      <span className="shop-price-tag">💰{item.price}</span>
                      <button className="btn btn-primary" disabled={busyKey === item.key} onClick={() => buy(item.key)}>
                        購入
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {shopGroups.length === 0 && !shopLoading && (
            <p style={{ color: "var(--text-dim)" }}>現在購入できるアイテムはありません。</p>
          )}
        </div>
      ) : (
        <>
          <form className="panel" onSubmit={createListing}>
            <h3>📤 出品する</h3>
            {marketMessage && <p style={{ color: "var(--success)" }}>{marketMessage}</p>}
            {marketError && <p className="error-text">{marketError}</p>}
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
              <>
                <select
                  value={selectedCharacterId}
                  onChange={(e) => setSelectedCharacterId(e.target.value)}
                  style={{ ...inputStyle, width: "100%" }}
                >
                  <option value="">キャラクターを選択</option>
                  {sellableCharacters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.rarity} Lv{c.level} {c.nationality}
                      {c.age}歳{c.gender}
                    </option>
                  ))}
                </select>
                {referenceSellPrice !== null && (
                  <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginTop: "0.5rem" }}>
                    参考: システム買取価格は💰{referenceSellPrice}です。
                  </p>
                )}
              </>
            ) : (
              <div className="btn-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={selectedItemKey}
                  onChange={(e) => setSelectedItemKey(e.target.value)}
                  style={{ ...inputStyle, flex: 1, minWidth: 160 }}
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
                  style={{ ...inputStyle, width: 90 }}
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
                style={{ ...inputStyle, width: 140 }}
              />
              <span style={{ color: "var(--text-dim)" }}>コイン</span>
            </div>

            <button
              className="btn btn-primary"
              type="submit"
              style={{ marginTop: "0.8rem" }}
              disabled={listing || (kind === "character" ? !selectedCharacterId : !selectedItemKey) || !price}
            >
              出品する
            </button>
          </form>

          <div className="panel">
            <h4 className="shop-section-title" style={accentStyle("#f1c40f")}>
              🧑 キャラクター出品
            </h4>
            <div className="result-grid">
              {characterListings.map((l) => (
                <MarketListingCard
                  key={l.id}
                  listing={l}
                  isMine={l.sellerId === user?.id}
                  busy={busyListingId === l.id}
                  onBuy={() => buyListing(l)}
                  onCancel={() => cancelListing(l)}
                />
              ))}
              {characterListings.length === 0 && <p style={{ color: "var(--text-dim)" }}>出品はまだありません。</p>}
            </div>
          </div>

          <div className="panel">
            <h4 className="shop-section-title" style={accentStyle(TIER_COLOR.shop)}>
              🎒 アイテム出品
            </h4>
            <div className="result-grid">
              {itemListings.map((l) => (
                <MarketListingCard
                  key={l.id}
                  listing={l}
                  isMine={l.sellerId === user?.id}
                  busy={busyListingId === l.id}
                  onBuy={() => buyListing(l)}
                  onCancel={() => cancelListing(l)}
                />
              ))}
              {itemListings.length === 0 && <p style={{ color: "var(--text-dim)" }}>出品はまだありません。</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MarketListingCard({
  listing: l,
  isMine,
  busy,
  onBuy,
  onCancel,
}: {
  listing: ListingRow;
  isMine: boolean;
  busy: boolean;
  onBuy: () => void;
  onCancel: () => void;
}) {
  const accent =
    l.kind === "character" && l.character ? RARITIES[l.character.rarity].color : TIER_COLOR[l.item?.tier ?? "shop"];

  return (
    <div className="shop-card" style={accentStyle(accent)}>
      {l.kind === "character" && l.character ? (
        <>
          <div style={{ fontWeight: 700 }}>
            <RarityTag rarity={l.character.rarity} /> Lv{l.character.level}
          </div>
          <div style={{ color: "var(--text-dim)", fontSize: "0.82rem", marginTop: "0.3rem" }}>
            {l.character.nationality}
            {l.character.age}歳{l.character.gender} / 🎭{l.character.feature}
          </div>
        </>
      ) : l.item ? (
        <>
          <div className="shop-card-icon">{l.item.emoji}</div>
          <div className="shop-card-name">
            {l.item.name} ×{l.itemQuantity}
          </div>
        </>
      ) : (
        <div className="shop-card-name">⚠️ {l.itemKey}(不明)</div>
      )}
      <div style={{ color: "var(--text-dim)", fontSize: "0.8rem", margin: "0.5rem 0 0.3rem" }}>
        出品者: {l.sellerDisplayName}
      </div>
      <div className="btn-row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <span className="shop-price-tag">💰{l.price}</span>
        {isMine ? (
          <button className="btn" style={{ color: "var(--danger)" }} disabled={busy} onClick={onCancel}>
            取り消す
          </button>
        ) : (
          <button className="btn btn-primary" disabled={busy} onClick={onBuy}>
            購入する
          </button>
        )}
      </div>
    </div>
  );
}
