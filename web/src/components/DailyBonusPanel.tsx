import { DAILY_BONUS_CYCLE_DAYS, dailyBonusRewardForStreak } from "@identity-slot/game-core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth-context";

interface DailyBonusStatus {
  canClaim: boolean;
  currentStreak: number;
  nextStreak: number;
  nextReward: number;
  lastClaimedAt: string | null;
}

export function DailyBonusPanel() {
  const { refresh } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["daily-bonus"],
    queryFn: () => api.get<DailyBonusStatus>("/daily-bonus"),
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function claim() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.post<{ money: number; streak: number; reward: number }>("/daily-bonus/claim");
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["daily-bonus"] }), refresh()]);
      setMessage(`🎁 ${res.reward}コイン受け取りました!(${res.streak}日目)`);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "受け取りに失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;

  const highlightDay = data.canClaim ? data.nextStreak : data.currentStreak;

  return (
    <div className="panel">
      <h2 style={{ margin: "0 0 0.5rem" }}>🎁 デイリーボーナス</h2>
      {message && <p style={{ color: "var(--success)" }}>{message}</p>}
      <div className="btn-row" style={{ marginBottom: "0.75rem", flexWrap: "wrap" }}>
        {Array.from({ length: DAILY_BONUS_CYCLE_DAYS }, (_, i) => i + 1).map((day) => {
          const isDone = day < highlightDay || (day === highlightDay && !data.canClaim);
          const isToday = day === highlightDay;
          return (
            <div
              key={day}
              className="card"
              style={{
                textAlign: "center",
                minWidth: 64,
                borderColor: isToday ? "var(--gold)" : undefined,
                opacity: isDone || isToday ? 1 : 0.45,
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                {day}日目{isDone && " ✓"}
              </div>
              <div style={{ color: "var(--gold)", fontWeight: 700 }}>💰{dailyBonusRewardForStreak(day)}</div>
            </div>
          );
        })}
      </div>
      <button className="btn btn-primary" disabled={busy || !data.canClaim} onClick={claim}>
        {data.canClaim ? `受け取る(💰${data.nextReward})` : "本日は受け取り済み"}
      </button>
    </div>
  );
}
