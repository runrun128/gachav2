import { Rarity } from "@identity-slot/game-core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { RarityTag } from "../components/RarityTag";
import { api } from "../lib/api";

interface GrantedCharacter {
  nationality: string;
  age: number;
  gender: string;
  feature: string;
  rarity: Rarity;
  secretFeature: string | null;
}

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  authorDisplayName: string;
  isPersonal: boolean;
  coinAmount: number | null;
  itemKey: string | null;
  itemAmount: number | null;
  itemName: string | null;
  itemEmoji: string | null;
  grantedCharacter: GrantedCharacter | null;
  createdAt: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function AnnouncementsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api.get<{ items: AnnouncementRow[] }>("/announcements"),
  });

  useEffect(() => {
    api
      .post("/announcements/mark-read")
      .then(() => queryClient.setQueryData(["announcements-unread-count"], { count: 0 }));
  }, [queryClient]);

  return (
    <div className="panel">
      <h1>📢 お知らせ</h1>
      {isLoading && <p>読み込み中……</p>}
      {data && data.items.length === 0 && <p style={{ color: "var(--text-dim)" }}>お知らせはまだありません。</p>}
      {data?.items.map((a) => (
        <div
          className="card"
          key={a.id}
          style={{ marginBottom: "0.85rem", borderColor: a.isPersonal ? "var(--gold)" : undefined }}
        >
          <div className="btn-row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <strong style={{ fontSize: "1.05rem" }}>
              {a.isPersonal && <span style={{ color: "var(--gold)" }}>💌 </span>}
              {a.title}
            </strong>
            <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>{formatDate(a.createdAt)}</span>
          </div>
          {a.isPersonal && (
            <p style={{ color: "var(--gold)", fontSize: "0.8rem", margin: "0.2rem 0 0" }}>あなた宛の個人メッセージ</p>
          )}
          <p style={{ whiteSpace: "pre-wrap", margin: "0.5rem 0" }}>{a.body}</p>
          {(a.coinAmount || a.itemKey || a.grantedCharacter) && (
            <div className="pill-row" style={{ marginBottom: 0 }}>
              {a.coinAmount && <span className="pill active">💰 +{a.coinAmount} コイン配布済み</span>}
              {a.itemKey && (
                <span className="pill active">
                  {a.itemEmoji} {a.itemName} ×{a.itemAmount} 配布済み
                </span>
              )}
            </div>
          )}
          {a.grantedCharacter && (
            <div className="card" style={{ marginTop: "0.5rem" }}>
              <RarityTag rarity={a.grantedCharacter.rarity} />
              <span style={{ color: "var(--gold)", fontSize: "0.8rem", marginLeft: "0.4rem" }}>👑運営限定</span>
              <div>
                {a.grantedCharacter.nationality}
                {a.grantedCharacter.age}歳{a.grantedCharacter.gender}
              </div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>🎭{a.grantedCharacter.feature}</div>
              {a.grantedCharacter.secretFeature && (
                <div style={{ color: "var(--gold)", fontSize: "0.85rem" }}>🔓{a.grantedCharacter.secretFeature}</div>
              )}
            </div>
          )}
          <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginTop: "0.5rem", marginBottom: 0 }}>
            運営: {a.authorDisplayName}
          </p>
        </div>
      ))}
    </div>
  );
}
