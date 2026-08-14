import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  authorDisplayName: string;
  coinAmount: number | null;
  itemKey: string | null;
  itemAmount: number | null;
  itemName: string | null;
  itemEmoji: string | null;
  createdAt: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function AnnouncementsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api.get<{ items: AnnouncementRow[] }>("/announcements"),
  });

  return (
    <div className="panel">
      <h1>📢 お知らせ</h1>
      {isLoading && <p>読み込み中……</p>}
      {data && data.items.length === 0 && <p style={{ color: "var(--text-dim)" }}>お知らせはまだありません。</p>}
      {data?.items.map((a) => (
        <div className="card" key={a.id} style={{ marginBottom: "0.85rem" }}>
          <div className="btn-row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <strong style={{ fontSize: "1.05rem" }}>{a.title}</strong>
            <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>{formatDate(a.createdAt)}</span>
          </div>
          <p style={{ whiteSpace: "pre-wrap", margin: "0.5rem 0" }}>{a.body}</p>
          {(a.coinAmount || a.itemKey) && (
            <div className="pill-row" style={{ marginBottom: 0 }}>
              {a.coinAmount && <span className="pill active">💰 +{a.coinAmount} コイン配布済み</span>}
              {a.itemKey && (
                <span className="pill active">
                  {a.itemEmoji} {a.itemName} ×{a.itemAmount} 配布済み
                </span>
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
