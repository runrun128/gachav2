import {
  GACHA10_COST,
  GACHA_COST,
  GACHA_SR_COST,
  GACHA_SSR_COST,
  RARITY_ORDER,
  Rarity,
  SPECIAL_TYPES,
  SpinResult,
} from "@identity-slot/game-core";
import { useEffect, useRef, useState } from "react";
import { RarityTag } from "../components/RarityTag";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth-context";

type PullType = "single" | "ten" | "sr" | "ssr";
type Phase = "idle" | "revealing" | "single-done" | "ten-suspense" | "ten-done";

const REVEAL_LABELS = ["🌍 出身国", "🎂 年齢", "⚧️ 性別", "🎭 特徴"];

export function GachaPage() {
  const { refresh } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState(0);
  const [results, setResults] = useState<SpinResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setInterval(() => setCooldown((c) => Math.max(0, c - 0.1)), 100);
    return () => window.clearInterval(t);
  }, [cooldown > 0]);

  async function spin(type: PullType) {
    if (phase === "revealing" || phase === "ten-suspense") return;
    setError(null);
    try {
      const res = await api.post<{ results: SpinResult[]; money: number }>("/gacha/spin", { type });
      setResults(res.results);
      await refresh();

      if (type === "ten") {
        setPhase("ten-suspense");
        window.setTimeout(() => setPhase("ten-done"), 1400);
      } else {
        setPhase("revealing");
        setStage(0);
        let s = 0;
        timerRef.current = window.setInterval(() => {
          s += 1;
          setStage(s);
          if (s >= REVEAL_LABELS.length) {
            if (timerRef.current) window.clearInterval(timerRef.current);
            setPhase("single-done");
          }
        }, 550);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        const match = err.message.match(/あと([\d.]+)秒/);
        if (match) setCooldown(parseFloat(match[1]));
      } else {
        setError("ガチャの実行に失敗しました。");
      }
    }
  }

  const busy = phase === "revealing" || phase === "ten-suspense";

  return (
    <div>
      <div className="panel">
        <h1>🎰 ガチャを選択</h1>
        <p style={{ color: "var(--text-dim)" }}>あなたの「もう一つの人生」を抽選します。</p>
        <div className="btn-row">
          <button className="btn btn-primary" disabled={busy || cooldown > 0} onClick={() => spin("single")}>
            🎰 1連({GACHA_COST}コイン)
          </button>
          <button className="btn btn-primary" disabled={busy || cooldown > 0} onClick={() => spin("ten")}>
            🔟 10連({GACHA10_COST}コイン)
          </button>
          <button className="btn" disabled={busy || cooldown > 0} onClick={() => spin("sr")}>
            🥈 SR以上確定({GACHA_SR_COST}コイン)
          </button>
          <button className="btn" disabled={busy || cooldown > 0} onClick={() => spin("ssr")}>
            🥇 SSR以上確定({GACHA_SSR_COST}コイン)
          </button>
        </div>
        {cooldown > 0 && <p className="error-text">⏳ あと{cooldown.toFixed(1)}秒待ってください</p>}
        {error && cooldown <= 0 && <p className="error-text">{error}</p>}
      </div>

      {phase === "revealing" && results[0] && (
        <div className="panel spin-reveal">
          <p>🎰 引いています……</p>
          {REVEAL_LABELS.map((label, i) => (
            <div key={label}>
              {label}: {i < stage ? <strong>{revealValue(results[0], i)}</strong> : "🔒 ???"}
            </div>
          ))}
        </div>
      )}

      {phase === "single-done" && results[0] && <SingleResultCard result={results[0]} />}

      {phase === "ten-suspense" && (
        <div className="panel spin-reveal">
          <p>🎰 10連抽選中……</p>
          <p style={{ color: "var(--text-dim)" }}>結果を確認しています……</p>
        </div>
      )}

      {phase === "ten-done" && <TenResultGrid results={results} />}
    </div>
  );
}

function revealValue(r: SpinResult, stage: number): string {
  switch (stage) {
    case 0:
      return r.nationality;
    case 1:
      return `${r.age}歳`;
    case 2:
      return r.gender;
    case 3:
      return r.feature;
    default:
      return "";
  }
}

function glowClassFor(rarity: Rarity): string {
  if (rarity === "MUR") return "glow-mur";
  if (rarity === "UR") return "glow-ur";
  if (rarity === "SSR") return "glow-ssr";
  return "";
}

function SingleResultCard({ result }: { result: SpinResult }) {
  return (
    <div className={`panel reveal-pop ${glowClassFor(result.rarity)}`}>
      <h2>
        <RarityTag rarity={result.rarity} /> FORTUNE TICKET
      </h2>
      <p style={{ fontSize: "1.3rem" }}>
        <strong>
          {result.nationality}
          {result.age}歳{result.gender}
        </strong>
      </p>
      <p>🎭 特徴: {result.feature}</p>
      {result.secretFeature && (
        <p>
          🔓 隠し特徴: <strong>{result.secretFeature}</strong>
          {result.specialType && (
            <>
              {" "}
              ({SPECIAL_TYPES[result.specialType].emoji}
              {SPECIAL_TYPES[result.specialType].label})
            </>
          )}
        </p>
      )}
    </div>
  );
}

function TenResultGrid({ results }: { results: SpinResult[] }) {
  const byRarity = [...RARITY_ORDER].reverse().map((r) => ({
    rarity: r as Rarity,
    items: results.filter((res) => res.rarity === r),
  }));

  const bestRarity = byRarity.find((g) => g.items.length > 0)?.rarity ?? "N";

  return (
    <div className={`panel reveal-pop ${glowClassFor(bestRarity)}`}>
      <h2>🎰 10 PULL RESULTS</h2>
      {byRarity
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <div key={g.rarity} style={{ marginBottom: "1rem" }}>
            <RarityTag rarity={g.rarity} /> ×{g.items.length}
            <div className="result-grid" style={{ marginTop: "0.5rem" }}>
              {g.items.map((r, idx) => (
                <div className={`card ${glowClassFor(r.rarity)}`} key={idx}>
                  <div>
                    {r.nationality}
                    {r.age}歳{r.gender}
                  </div>
                  <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>🎭{r.feature}</div>
                  {r.secretFeature && (
                    <div style={{ color: "var(--gold)", fontSize: "0.85rem" }}>🔓{r.secretFeature}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
