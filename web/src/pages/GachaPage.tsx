import {
  GACHA10_COST,
  GACHA_COST,
  GACHA_SR_COST,
  GACHA_SSR_COST,
  RARITIES,
  RARITY_ORDER,
  Rarity,
  SPECIAL_TYPES,
  SpinResult,
} from "@identity-slot/game-core";
import { useQuery } from "@tanstack/react-query";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { RarityTag } from "../components/RarityTag";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth-context";

type PullType = "single" | "ten" | "sr" | "ssr";
type Phase = "idle" | "shuffling" | "revealing" | "single-done" | "ten-shuffling" | "ten-done";

interface LimitedBanner {
  key: string;
  name: string;
  description: string;
  cost: number;
}

const REVEAL_LABELS = ["🌍 出身国", "🎂 年齢", "⚧️ 性別", "🎭 特徴"];
const SHUFFLE_MS = 650;
const TEN_SHUFFLE_MS = 1000;
const FLASH_MS = 400;

function isFlashyRarity(r: Rarity): boolean {
  return r === "SSR" || r === "UR" || r === "MUR" || r === "KMR" || r === "LTD";
}

function rarityStyle(r: Rarity): CSSProperties {
  return { "--rc": RARITIES[r].color } as CSSProperties;
}

const goldStyle = { "--rc": "#d4af37" } as CSSProperties;

function minDelay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function GachaPage() {
  const { refresh } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState(0);
  const [results, setResults] = useState<SpinResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [flash, setFlash] = useState(false);
  const timerRef = useRef<number | null>(null);

  const { data: limitedData } = useQuery({
    queryKey: ["limited-gacha"],
    queryFn: () => api.get<{ banners: LimitedBanner[] }>("/gacha/limited"),
  });
  const limitedBanners = limitedData?.banners ?? [];

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    // 100ms間隔だと数秒間ページ全体が毎秒10回再描画されて重くなるため、
    // 見た目の滑らかさを保てる範囲で間隔を広げる
    const t = window.setInterval(() => setCooldown((c) => Math.max(0, c - 0.25)), 250);
    return () => window.clearInterval(t);
  }, [cooldown > 0]);

  function beginSingleReveal(res: { results: SpinResult[]; money: number }) {
    setResults(res.results);
    setPhase("revealing");
    let s = 0;
    timerRef.current = window.setInterval(() => {
      s += 1;
      setStage(s);
      if (s >= REVEAL_LABELS.length) {
        if (timerRef.current) window.clearInterval(timerRef.current);
        const rarity = res.results[0]?.rarity;
        if (rarity && isFlashyRarity(rarity)) {
          setFlash(true);
          window.setTimeout(() => setFlash(false), FLASH_MS);
          window.setTimeout(() => setPhase("single-done"), 180);
        } else {
          setPhase("single-done");
        }
      }
    }, 550);
  }

  function handleSpinError(err: unknown) {
    setPhase("idle");
    if (err instanceof ApiError) {
      setError(err.message);
      const match = err.message.match(/あと([\d.]+)秒/);
      if (match) setCooldown(parseFloat(match[1]));
    } else {
      setError("ガチャの実行に失敗しました。");
    }
  }

  async function spin(type: PullType) {
    if (phase === "revealing" || phase === "shuffling" || phase === "ten-shuffling") return;
    setError(null);
    setStage(0);
    setPhase(type === "ten" ? "ten-shuffling" : "shuffling");
    try {
      const [res] = await Promise.all([
        api.post<{ results: SpinResult[]; money: number }>("/gacha/spin", { type }),
        minDelay(type === "ten" ? TEN_SHUFFLE_MS : SHUFFLE_MS),
      ]);
      await refresh();

      if (type === "ten") {
        setResults(res.results);
        const bestRarity = pickBestRarity(res.results);
        if (isFlashyRarity(bestRarity)) {
          setFlash(true);
          window.setTimeout(() => setFlash(false), FLASH_MS);
        }
        setPhase("ten-done");
      } else {
        beginSingleReveal(res);
      }
    } catch (err) {
      handleSpinError(err);
    }
  }

  async function spinLimited(key: string) {
    if (phase === "revealing" || phase === "shuffling" || phase === "ten-shuffling") return;
    setError(null);
    setStage(0);
    setPhase("shuffling");
    try {
      const [res] = await Promise.all([
        api.post<{ result: SpinResult; money: number }>(`/gacha/limited/${key}/spin`, {}),
        minDelay(SHUFFLE_MS),
      ]);
      await refresh();
      beginSingleReveal({ results: [res.result], money: res.money });
    } catch (err) {
      handleSpinError(err);
    }
  }

  const busy = phase === "revealing" || phase === "shuffling" || phase === "ten-shuffling";

  return (
    <div>
      {flash && <div className="gacha-flash" />}

      {limitedBanners.map((banner) => (
        <div className="panel limited-banner" key={banner.key}>
          <h2 style={{ margin: 0 }}>{banner.name}</h2>
          <p style={{ color: "var(--text-dim)" }}>{banner.description}</p>
          <button className="btn btn-primary" disabled={busy || cooldown > 0} onClick={() => spinLimited(banner.key)}>
            🎉 引く({banner.cost}コイン)
          </button>
        </div>
      ))}

      <div className="panel">
        <h1>🎰 ガチャを選択</h1>
        <p style={{ color: "var(--text-dim)" }}>あなたの「もう一つの人生」を抽選します。</p>
        <div className="gacha-option-grid">
          <button
            className="gacha-option-card"
            style={goldStyle}
            disabled={busy || cooldown > 0}
            onClick={() => spin("single")}
          >
            <span className="gacha-option-icon">🎰</span>
            <span className="gacha-option-title">1連</span>
            <span className="gacha-option-cost">{GACHA_COST}コイン</span>
          </button>
          <button
            className="gacha-option-card gacha-option-featured"
            style={goldStyle}
            disabled={busy || cooldown > 0}
            onClick={() => spin("ten")}
          >
            <span className="gacha-option-badge">お得</span>
            <span className="gacha-option-icon">🔟</span>
            <span className="gacha-option-title">10連</span>
            <span className="gacha-option-cost">{GACHA10_COST}コイン</span>
          </button>
          <button
            className="gacha-option-card"
            style={rarityStyle("SR")}
            disabled={busy || cooldown > 0}
            onClick={() => spin("sr")}
          >
            <span className="gacha-option-icon">🥈</span>
            <span className="gacha-option-title">SR以上確定</span>
            <span className="gacha-option-cost">{GACHA_SR_COST}コイン</span>
          </button>
          <button
            className="gacha-option-card"
            style={rarityStyle("SSR")}
            disabled={busy || cooldown > 0}
            onClick={() => spin("ssr")}
          >
            <span className="gacha-option-icon">🥇</span>
            <span className="gacha-option-title">SSR以上確定</span>
            <span className="gacha-option-cost">{GACHA_SSR_COST}コイン</span>
          </button>
        </div>
        {cooldown > 0 && <p className="error-text">⏳ あと{cooldown.toFixed(1)}秒待ってください</p>}
        {error && cooldown <= 0 && <p className="error-text">{error}</p>}
      </div>

      {phase === "shuffling" && <ShuffleCard label="占い中……" />}

      {phase === "revealing" && (
        <div className="panel stage-reveal-list">
          {REVEAL_LABELS.map((label, i) => (
            <div key={label}>
              {label}:{" "}
              {i < stage && results[0] ? (
                <strong key={`v-${i}`} className="stage-flip">
                  {revealValue(results[0], i)}
                </strong>
              ) : (
                "🔒 ???"
              )}
            </div>
          ))}
        </div>
      )}

      {phase === "single-done" && results[0] && <SingleResultCard result={results[0]} />}

      {phase === "ten-shuffling" && <ShuffleCard label="10連抽選中……" />}

      {phase === "ten-done" && <TenResultGrid results={results} />}
    </div>
  );
}

function pickBestRarity(results: SpinResult[]): Rarity {
  for (const r of [...RARITY_ORDER].reverse()) {
    if (results.some((res) => res.rarity === r)) return r;
  }
  return "N";
}

function ShuffleCard({ label }: { label: string }) {
  return (
    <div className="panel">
      <div className="gacha-shuffle-wrap">
        <div className="gacha-shuffle-card">🔮</div>
      </div>
      <p style={{ textAlign: "center", color: "var(--text-dim)" }}>{label}</p>
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
  if (rarity === "LTD") return "glow-ltd";
  if (rarity === "KMR") return "glow-kmr";
  if (rarity === "MUR") return "glow-mur";
  if (rarity === "UR") return "glow-ur";
  if (rarity === "SSR") return "glow-ssr";
  return "";
}

function SingleResultCard({ result }: { result: SpinResult }) {
  const shiny = isFlashyRarity(result.rarity) && result.rarity !== "SSR";
  return (
    <div
      className={`ticket-card ${glowClassFor(result.rarity)} ${shiny ? "ticket-card-shine" : ""}`}
      style={rarityStyle(result.rarity)}
    >
      <h2 style={{ marginTop: 0 }}>
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
        <>
          <div className="ticket-card-divider" />
          <p style={{ margin: 0 }}>
            🔓 隠し特徴: <strong>{result.secretFeature}</strong>
            {result.specialType && (
              <>
                {" "}
                ({SPECIAL_TYPES[result.specialType].emoji}
                {SPECIAL_TYPES[result.specialType].label})
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}

function TenResultGrid({ results }: { results: SpinResult[] }) {
  const byRarity = [...RARITY_ORDER].reverse().map((r) => ({
    rarity: r as Rarity,
    items: results.filter((res) => res.rarity === r),
  }));

  const bestRarity = pickBestRarity(results);

  let cardIndex = 0;

  return (
    <div className={`panel reveal-pop ${glowClassFor(bestRarity)}`}>
      <h2>🎰 10 PULL RESULTS</h2>
      {byRarity
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <div key={g.rarity} style={{ marginBottom: "1rem" }}>
            <RarityTag rarity={g.rarity} /> ×{g.items.length}
            <div className="result-grid" style={{ marginTop: "0.5rem" }}>
              {g.items.map((r, idx) => {
                const delay = cardIndex * 60;
                cardIndex += 1;
                return (
                  <div
                    className="mini-ticket"
                    key={idx}
                    style={{ ...rarityStyle(r.rarity), "--d": `${delay}ms` } as CSSProperties}
                  >
                    <RarityTag rarity={r.rarity} />
                    <div style={{ marginTop: "0.3rem" }}>
                      {r.nationality}
                      {r.age}歳{r.gender}
                    </div>
                    <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>🎭{r.feature}</div>
                    {r.secretFeature && (
                      <div style={{ color: "var(--gold)", fontSize: "0.85rem" }}>🔓{r.secretFeature}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
