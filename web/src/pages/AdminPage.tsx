import { ItemDef, SPECIAL_TYPE_ORDER, SPECIAL_TYPES } from "@identity-slot/game-core";
import { useQuery } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { api, ApiError } from "../lib/api";

interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  money: number;
  role: string;
}

export function AdminPage() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<AdminUser | null>(null);

  const [moneyAmount, setMoneyAmount] = useState("10000");
  const [itemKey, setItemKey] = useState("");
  const [itemAmount, setItemAmount] = useState("10");
  const [broadcastItemKey, setBroadcastItemKey] = useState("");
  const [broadcastAmount, setBroadcastAmount] = useState("1");

  const [charNationality, setCharNationality] = useState("");
  const [charAge, setCharAge] = useState("20");
  const [charGender, setCharGender] = useState("");
  const [charFeature, setCharFeature] = useState("");
  const [charSecretFeature, setCharSecretFeature] = useState("");
  const [charSpecialType, setCharSpecialType] = useState(SPECIAL_TYPE_ORDER[0]);

  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceBody, setAnnounceBody] = useState("");
  const [announceCoin, setAnnounceCoin] = useState("");
  const [announceItemKey, setAnnounceItemKey] = useState("");
  const [announceItemAmount, setAnnounceItemAmount] = useState("1");

  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: itemsData } = useQuery({
    queryKey: ["admin-items"],
    queryFn: () => api.get<{ items: ItemDef[] }>("/admin/items"),
  });

  async function search(e?: FormEvent) {
    e?.preventDefault();
    setSearching(true);
    setErrorMessage(null);
    try {
      const res = await api.get<{ users: AdminUser[] }>(`/admin/users?q=${encodeURIComponent(query)}`);
      setUsers(res.users);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "検索に失敗しました。");
    } finally {
      setSearching(false);
    }
  }

  function refreshSelected(patch: Partial<AdminUser>) {
    setSelected((s) => (s ? { ...s, ...patch } : s));
    setUsers((list) => list.map((u) => (u.id === patch.id ? { ...u, ...patch } : u)));
  }

  async function giveMoney(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const res = await api.post<{ id: string; displayName: string; money: number }>("/admin/give-money", {
        userId: selected.id,
        amount: Number(moneyAmount),
      });
      refreshSelected({ id: res.id, money: res.money });
      setMessage(`${res.displayName} に ${moneyAmount} コインを付与しました。(残高: ${res.money})`);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "コイン付与に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function giveItem(e: FormEvent) {
    e.preventDefault();
    if (!selected || !itemKey) return;
    setBusy(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const res = await api.post<{ userId: string; itemKey: string; quantity: number }>("/admin/give-item", {
        userId: selected.id,
        itemKey,
        amount: Number(itemAmount),
      });
      setMessage(`${selected.displayName} に ${itemsData?.items.find((i) => i.key === itemKey)?.name} を付与しました。(所持数: ${res.quantity})`);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "アイテム付与に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function giveCharacter(e: FormEvent) {
    e.preventDefault();
    if (!selected || !charNationality.trim() || !charGender.trim() || !charFeature.trim() || !charSecretFeature.trim())
      return;
    setBusy(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      await api.post("/admin/give-character", {
        userId: selected.id,
        nationality: charNationality,
        age: Number(charAge),
        gender: charGender,
        feature: charFeature,
        secretFeature: charSecretFeature,
        specialType: charSpecialType,
      });
      setMessage(`${selected.displayName} に運営限定キャラクターを付与しました。`);
      setCharNationality("");
      setCharGender("");
      setCharFeature("");
      setCharSecretFeature("");
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "キャラクター付与に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function broadcastItem(e: FormEvent) {
    e.preventDefault();
    if (!broadcastItemKey) return;
    setBusy(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const res = await api.post<{ recipientCount: number }>("/admin/broadcast-item", {
        itemKey: broadcastItemKey,
        amount: Number(broadcastAmount),
      });
      setMessage(`全プレイヤー(${res.recipientCount}人)にアイテムを配布しました。`);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "配布に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function sendAnnouncement(e: FormEvent) {
    e.preventDefault();
    if (!announceTitle.trim() || !announceBody.trim()) return;
    setBusy(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const res = await api.post<{ id: string; recipientCount: number }>("/admin/announcements", {
        title: announceTitle,
        body: announceBody,
        coinAmount: announceCoin ? Number(announceCoin) : undefined,
        itemKey: announceItemKey || undefined,
        itemAmount: announceItemKey ? Number(announceItemAmount) : undefined,
      });
      setMessage(`お知らせを送信しました。(配布対象: ${res.recipientCount}人)`);
      setAnnounceTitle("");
      setAnnounceBody("");
      setAnnounceCoin("");
      setAnnounceItemKey("");
      setAnnounceItemAmount("1");
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "お知らせの送信に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="panel">
        <h1>⚙️ 運営パネル</h1>
        <p style={{ color: "var(--text-dim)" }}>運営限定。コイン・アイテムを制限なく配布できます。</p>
        {message && <p style={{ color: "var(--success)" }}>{message}</p>}
        {errorMessage && <p className="error-text">{errorMessage}</p>}
      </div>

      <form className="panel" onSubmit={search}>
        <h3>🔍 ユーザー検索</h3>
        <div className="btn-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="表示名またはメールアドレス"
            style={{
              background: "var(--bg-panel-raised)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.6rem 0.75rem",
              color: "var(--text)",
              flex: 1,
              minWidth: 200,
            }}
          />
          <button className="btn" type="submit" disabled={searching}>
            検索
          </button>
        </div>
        <div className="result-grid" style={{ marginTop: "1rem" }}>
          {users.map((u) => (
            <button
              type="button"
              className="card"
              key={u.id}
              style={{ borderColor: selected?.id === u.id ? "var(--gold)" : undefined }}
              onClick={() => setSelected(u)}
            >
              <div style={{ fontWeight: 700 }}>
                {u.displayName} {u.role === "admin" && "⚙️"}
              </div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>{u.email}</div>
              <div style={{ color: "var(--gold)", fontSize: "0.85rem" }}>💰 {u.money} コイン</div>
            </button>
          ))}
        </div>
      </form>

      {selected && (
        <div className="panel">
          <h3>対象: {selected.displayName}</h3>

          <form onSubmit={giveMoney} className="btn-row" style={{ alignItems: "center", marginBottom: "0.75rem" }}>
            <span style={{ minWidth: 100 }}>💰 コイン付与</span>
            <input
              type="number"
              min={1}
              value={moneyAmount}
              onChange={(e) => setMoneyAmount(e.target.value)}
              style={{
                background: "var(--bg-panel-raised)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "0.5rem 0.6rem",
                color: "var(--text)",
                width: 140,
              }}
            />
            <button className="btn btn-primary" type="submit" disabled={busy}>
              付与
            </button>
          </form>

          <form onSubmit={giveItem} className="btn-row" style={{ alignItems: "center" }}>
            <span style={{ minWidth: 100 }}>🎒 アイテム付与</span>
            <select
              value={itemKey}
              onChange={(e) => setItemKey(e.target.value)}
              style={{
                background: "var(--bg-panel-raised)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "0.5rem 0.6rem",
                color: "var(--text)",
              }}
            >
              <option value="">選択してください</option>
              {itemsData?.items.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.emoji} {i.name}({i.tier})
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={itemAmount}
              onChange={(e) => setItemAmount(e.target.value)}
              style={{
                background: "var(--bg-panel-raised)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "0.5rem 0.6rem",
                color: "var(--text)",
                width: 100,
              }}
            />
            <button className="btn btn-primary" type="submit" disabled={busy || !itemKey}>
              付与
            </button>
          </form>

          <form onSubmit={giveCharacter} style={{ marginTop: "1.25rem" }}>
            <h4 style={{ margin: "0 0 0.5rem" }}>🌟 運営限定キャラクターを付与</h4>
            <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginTop: 0 }}>
              ガチャの抽選には出てこない特別なキャラクターを直接付与します(常にMURレアリティ)。
            </p>
            <div className="btn-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
              <input
                value={charNationality}
                onChange={(e) => setCharNationality(e.target.value)}
                placeholder="国籍(例: 運営)"
                maxLength={30}
                style={{
                  background: "var(--bg-panel-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.5rem 0.6rem",
                  color: "var(--text)",
                  width: 140,
                }}
              />
              <input
                type="number"
                value={charAge}
                onChange={(e) => setCharAge(e.target.value)}
                placeholder="年齢"
                style={{
                  background: "var(--bg-panel-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.5rem 0.6rem",
                  color: "var(--text)",
                  width: 90,
                }}
              />
              <input
                value={charGender}
                onChange={(e) => setCharGender(e.target.value)}
                placeholder="性別"
                maxLength={20}
                style={{
                  background: "var(--bg-panel-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.5rem 0.6rem",
                  color: "var(--text)",
                  width: 100,
                }}
              />
            </div>
            <div className="btn-row" style={{ alignItems: "center", flexWrap: "wrap", marginTop: "0.6rem" }}>
              <input
                value={charFeature}
                onChange={(e) => setCharFeature(e.target.value)}
                placeholder="特徴(例: 伝説の運営)"
                maxLength={40}
                style={{
                  background: "var(--bg-panel-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.5rem 0.6rem",
                  color: "var(--text)",
                  flex: 1,
                  minWidth: 160,
                }}
              />
              <input
                value={charSecretFeature}
                onChange={(e) => setCharSecretFeature(e.target.value)}
                placeholder="隠し特徴"
                maxLength={60}
                style={{
                  background: "var(--bg-panel-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.5rem 0.6rem",
                  color: "var(--text)",
                  flex: 1,
                  minWidth: 160,
                }}
              />
            </div>
            <div className="btn-row" style={{ alignItems: "center", marginTop: "0.6rem" }}>
              <select
                value={charSpecialType}
                onChange={(e) => setCharSpecialType(e.target.value as typeof SPECIAL_TYPE_ORDER[number])}
                style={{
                  background: "var(--bg-panel-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.5rem 0.6rem",
                  color: "var(--text)",
                }}
              >
                {SPECIAL_TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {SPECIAL_TYPES[t].emoji} {SPECIAL_TYPES[t].label}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={
                  busy || !charNationality.trim() || !charGender.trim() || !charFeature.trim() || !charSecretFeature.trim()
                }
              >
                付与
              </button>
            </div>
          </form>
        </div>
      )}

      <form className="panel" onSubmit={sendAnnouncement}>
        <h3>📢 お知らせを送信</h3>
        <p style={{ color: "var(--text-dim)", fontSize: "0.88rem" }}>
          全プレイヤーの「お知らせ」画面に表示されます。コイン・アイテムを付けると全員に自動配布されます。
        </p>
        <div className="form-field">
          <label>タイトル</label>
          <input value={announceTitle} onChange={(e) => setAnnounceTitle(e.target.value)} maxLength={60} required />
        </div>
        <div className="form-field">
          <label>本文</label>
          <textarea
            value={announceBody}
            onChange={(e) => setAnnounceBody(e.target.value)}
            maxLength={2000}
            rows={4}
            required
            style={{
              background: "var(--bg-panel-raised)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.6rem 0.75rem",
              color: "var(--text)",
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
        </div>
        <div className="btn-row" style={{ alignItems: "center", marginBottom: "0.75rem" }}>
          <span style={{ minWidth: 130 }}>💰 コイン付与(任意)</span>
          <input
            type="number"
            min={1}
            placeholder="未入力なら付与なし"
            value={announceCoin}
            onChange={(e) => setAnnounceCoin(e.target.value)}
            style={{
              background: "var(--bg-panel-raised)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.5rem 0.6rem",
              color: "var(--text)",
              width: 180,
            }}
          />
        </div>
        <div className="btn-row" style={{ alignItems: "center" }}>
          <span style={{ minWidth: 130 }}>🎒 アイテム付与(任意)</span>
          <select
            value={announceItemKey}
            onChange={(e) => setAnnounceItemKey(e.target.value)}
            style={{
              background: "var(--bg-panel-raised)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.5rem 0.6rem",
              color: "var(--text)",
            }}
          >
            <option value="">付与しない</option>
            {itemsData?.items.map((i) => (
              <option key={i.key} value={i.key}>
                {i.emoji} {i.name}({i.tier})
              </option>
            ))}
          </select>
          {announceItemKey && (
            <input
              type="number"
              min={1}
              value={announceItemAmount}
              onChange={(e) => setAnnounceItemAmount(e.target.value)}
              style={{
                background: "var(--bg-panel-raised)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "0.5rem 0.6rem",
                color: "var(--text)",
                width: 100,
              }}
            />
          )}
        </div>
        <button
          className="btn btn-primary"
          type="submit"
          style={{ marginTop: "1rem" }}
          disabled={busy || !announceTitle.trim() || !announceBody.trim()}
        >
          送信する
        </button>
      </form>

      <form className="panel" onSubmit={broadcastItem}>
        <h3>📢 全員配布(お知らせなし)</h3>
        <p style={{ color: "var(--text-dim)", fontSize: "0.88rem" }}>登録済みの全プレイヤーにアイテムを一括配布します。</p>
        <div className="btn-row" style={{ alignItems: "center" }}>
          <select
            value={broadcastItemKey}
            onChange={(e) => setBroadcastItemKey(e.target.value)}
            style={{
              background: "var(--bg-panel-raised)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.5rem 0.6rem",
              color: "var(--text)",
            }}
          >
            <option value="">選択してください</option>
            {itemsData?.items.map((i) => (
              <option key={i.key} value={i.key}>
                {i.emoji} {i.name}({i.tier})
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={broadcastAmount}
            onChange={(e) => setBroadcastAmount(e.target.value)}
            style={{
              background: "var(--bg-panel-raised)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.5rem 0.6rem",
              color: "var(--text)",
              width: 100,
            }}
          />
          <button className="btn" type="submit" disabled={busy || !broadcastItemKey}>
            全員に配布
          </button>
        </div>
      </form>
    </div>
  );
}
