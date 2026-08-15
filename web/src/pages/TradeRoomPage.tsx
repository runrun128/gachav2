import { ItemDef, Rarity, isCharacterSellable } from "@identity-slot/game-core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RarityTag } from "../components/RarityTag";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useSocket } from "../lib/socket-context";

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

interface TradeOfferItemDTO {
  itemKey: string;
  quantity: number;
  item: ItemDef | null;
}

interface TradeOfferDTO {
  characters: CharacterRow[];
  items: TradeOfferItemDTO[];
  coins: number;
  confirmed: boolean;
}

interface TradeStateDTO {
  roomId: string;
  userIds: [string, string];
  displayNames: Record<string, string>;
  offers: Record<string, TradeOfferDTO>;
}

interface AckResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface DraftItem {
  itemKey: string;
  quantity: number;
}

function sortedKey(characterIds: string[], items: DraftItem[], coins: number) {
  return JSON.stringify({
    c: [...characterIds].sort(),
    i: items
      .filter((it) => it.quantity > 0)
      .map((it) => `${it.itemKey}:${it.quantity}`)
      .sort(),
    coins,
  });
}

export function TradeRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { socket } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<TradeStateDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failMessage, setFailMessage] = useState<string | null>(null);
  const [finished, setFinished] = useState<"completed" | "cancelled" | null>(null);
  const [busy, setBusy] = useState(false);

  const [draftCharacterIds, setDraftCharacterIds] = useState<string[]>([]);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [draftCoins, setDraftCoins] = useState("0");
  const initializedRef = useRef(false);

  const { data: charactersData } = useQuery({
    queryKey: ["trade-characters"],
    queryFn: () => api.get<{ items: CharacterRow[] }>("/characters/mine"),
  });
  const { data: inventoryData } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => api.get<{ items: InventoryRow[] }>("/inventory"),
  });

  useEffect(() => {
    if (!socket || !roomId) return;

    function onState(payload: TradeStateDTO) {
      if (payload.roomId === roomId) {
        setState(payload);
        setError(null);
      }
    }
    function onFailed(payload: { roomId: string; message: string }) {
      if (payload.roomId === roomId) setFailMessage(payload.message);
    }
    function onCompleted(payload: { roomId: string }) {
      if (payload.roomId === roomId) setFinished("completed");
    }
    function onCancelled(payload: { roomId: string }) {
      if (payload.roomId === roomId) setFinished("cancelled");
    }

    socket.on("trade:state", onState);
    socket.on("trade:failed", onFailed);
    socket.on("trade:completed", onCompleted);
    socket.on("trade:cancelled", onCancelled);
    socket.emit("trade:joinRoom", { roomId }, (res: AckResponse) => {
      if (!res.ok) setError(res.error ?? "トレードへの参加に失敗しました。");
    });

    return () => {
      socket.off("trade:state", onState);
      socket.off("trade:failed", onFailed);
      socket.off("trade:completed", onCompleted);
      socket.off("trade:cancelled", onCancelled);
    };
  }, [socket, roomId]);

  const partnerId = state?.userIds.find((id) => id !== user?.id);
  const myOffer = user ? state?.offers[user.id] : undefined;
  const theirOffer = partnerId ? state?.offers[partnerId] : undefined;

  useEffect(() => {
    if (initializedRef.current || !myOffer) return;
    initializedRef.current = true;
    setDraftCharacterIds(myOffer.characters.map((c) => c.id));
    setDraftItems(myOffer.items.map((i) => ({ itemKey: i.itemKey, quantity: i.quantity })));
    setDraftCoins(String(myOffer.coins));
  }, [myOffer]);

  if (error) {
    return (
      <div className="panel">
        <p className="error-text">{error}</p>
        <button className="btn" onClick={() => navigate("/trade")}>
          ロビーに戻る
        </button>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="panel reveal-pop">
        <h2>{finished === "completed" ? "🎉 トレードが成立しました!" : "🚫 トレードは中止されました"}</h2>
        <button className="btn btn-primary" onClick={() => navigate("/trade")}>
          ロビーに戻る
        </button>
      </div>
    );
  }

  if (!state || !user || !partnerId || !myOffer || !theirOffer) {
    return <p>読み込み中……</p>;
  }

  const draftCoinsNum = Math.max(0, Math.min(Number(draftCoins) || 0, user.money));
  const dirty = sortedKey(draftCharacterIds, draftItems, draftCoinsNum) !== sortedKey(
    myOffer.characters.map((c) => c.id),
    myOffer.items,
    myOffer.coins
  );

  function toggleCharacter(id: string) {
    setDraftCharacterIds((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id]));
  }

  function setItemQuantity(itemKey: string, quantity: number) {
    setDraftItems((cur) => {
      const next = cur.filter((i) => i.itemKey !== itemKey);
      if (quantity > 0) next.push({ itemKey, quantity });
      return next;
    });
  }

  function applyOffer() {
    if (!socket || !roomId) return;
    setBusy(true);
    setError(null);
    socket.emit(
      "trade:updateOffer",
      { roomId, characterIds: draftCharacterIds, items: draftItems, coins: draftCoinsNum },
      (res: AckResponse) => {
        setBusy(false);
        if (!res.ok) setError(res.error ?? "オファーの更新に失敗しました。");
      }
    );
  }

  function confirm() {
    if (!socket || !roomId) return;
    setBusy(true);
    socket.emit("trade:confirm", { roomId }, (res: AckResponse) => {
      setBusy(false);
      if (!res.ok) setError(res.error ?? "確定に失敗しました。");
    });
  }

  function cancelTrade() {
    if (!socket || !roomId) return;
    socket.emit("trade:cancel", { roomId }, () => {});
  }

  const sellableCharacters = (charactersData?.items ?? []).filter((c) => isCharacterSellable(c.rarity, c.isExclusive));

  return (
    <div>
      <div className="panel">
        <h1>🔄 トレード: {state.displayNames[partnerId]}</h1>
        {failMessage && <p className="error-text">⚠️ {failMessage}</p>}
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="btn-row" style={{ alignItems: "stretch", flexWrap: "wrap" }}>
        <div className="panel" style={{ flex: 1, minWidth: 280 }}>
          <h3>あなたの提示 {myOffer.confirmed && !dirty ? "✅確認済み" : ""}</h3>

          <div className="form-field">
            <label>コイン(所持: {user.money})</label>
            <input
              type="number"
              min={0}
              max={user.money}
              value={draftCoins}
              onChange={(e) => setDraftCoins(e.target.value)}
              style={{
                background: "var(--bg-panel-raised)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "0.5rem 0.6rem",
                color: "var(--text)",
                width: "100%",
              }}
            />
          </div>

          <h4 style={{ marginTop: "0.8rem" }}>キャラクター({draftCharacterIds.length})</h4>
          <div className="result-grid" style={{ maxHeight: 260, overflowY: "auto" }}>
            {sellableCharacters.map((c) => {
              const selected = draftCharacterIds.includes(c.id);
              return (
                <button
                  type="button"
                  key={c.id}
                  className="card"
                  style={{ borderColor: selected ? "var(--gold)" : undefined, textAlign: "left" }}
                  onClick={() => toggleCharacter(c.id)}
                >
                  <RarityTag rarity={c.rarity} /> Lv{c.level}
                  <div style={{ fontSize: "0.82rem" }}>
                    {c.nationality}
                    {c.age}歳{c.gender}
                  </div>
                  {selected && <div style={{ color: "var(--gold)", fontSize: "0.8rem" }}>✓ 選択中</div>}
                </button>
              );
            })}
            {sellableCharacters.length === 0 && (
              <p style={{ color: "var(--text-dim)" }}>提示できるキャラクターがいません。</p>
            )}
          </div>

          <h4 style={{ marginTop: "0.8rem" }}>アイテム</h4>
          <div className="result-grid" style={{ maxHeight: 220, overflowY: "auto" }}>
            {inventoryData?.items.map((item) => {
              const draft = draftItems.find((i) => i.itemKey === item.itemKey);
              return (
                <div className="card" key={item.itemKey}>
                  <div style={{ fontWeight: 700 }}>
                    {item.emoji} {item.name} (所持{item.quantity})
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={item.quantity}
                    value={draft?.quantity ?? 0}
                    onChange={(e) =>
                      setItemQuantity(item.itemKey, Math.max(0, Math.min(item.quantity, Number(e.target.value) || 0)))
                    }
                    style={{
                      background: "var(--bg-panel-raised)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "0.4rem 0.5rem",
                      color: "var(--text)",
                      width: "100%",
                      marginTop: "0.4rem",
                    }}
                  />
                </div>
              );
            })}
            {(!inventoryData || inventoryData.items.length === 0) && (
              <p style={{ color: "var(--text-dim)" }}>アイテムを持っていません。</p>
            )}
          </div>

          <div className="btn-row" style={{ marginTop: "1rem" }}>
            <button className="btn" disabled={busy || !dirty} onClick={applyOffer}>
              オファーを更新
            </button>
            <button className="btn btn-primary" disabled={busy || dirty || myOffer.confirmed} onClick={confirm}>
              {myOffer.confirmed && !dirty ? "確認済み" : "確定する"}
            </button>
          </div>
        </div>

        <div className="panel" style={{ flex: 1, minWidth: 280 }}>
          <h3>
            {state.displayNames[partnerId]}の提示 {theirOffer.confirmed ? "✅確認済み" : "…調整中"}
          </h3>

          <p style={{ color: "var(--gold)" }}>💰 {theirOffer.coins} コイン</p>

          <h4>キャラクター({theirOffer.characters.length})</h4>
          <div className="result-grid">
            {theirOffer.characters.map((c) => (
              <div className="card" key={c.id}>
                <RarityTag rarity={c.rarity} /> Lv{c.level}
                <div style={{ fontSize: "0.82rem" }}>
                  {c.nationality}
                  {c.age}歳{c.gender}
                </div>
              </div>
            ))}
            {theirOffer.characters.length === 0 && <p style={{ color: "var(--text-dim)" }}>なし</p>}
          </div>

          <h4 style={{ marginTop: "0.8rem" }}>アイテム</h4>
          <div className="result-grid">
            {theirOffer.items.map((i) => (
              <div className="card" key={i.itemKey}>
                {i.item ? `${i.item.emoji} ${i.item.name}` : i.itemKey} ×{i.quantity}
              </div>
            ))}
            {theirOffer.items.length === 0 && <p style={{ color: "var(--text-dim)" }}>なし</p>}
          </div>
        </div>
      </div>

      <div className="panel">
        <button className="btn" style={{ color: "var(--danger)" }} onClick={cancelTrade}>
          🚫 トレードをキャンセル
        </button>
      </div>
    </div>
  );
}
