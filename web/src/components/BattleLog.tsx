import { useState } from "react";
import { useStaggeredLines } from "../hooks/useStaggeredLines";

/** 最後の「🎬」(ラウンド開始)マーカー以降を「最新ラウンド」として切り出す */
function splitLatestRound(log: string[]): { history: string[]; latest: string[] } {
  let markerIndex = -1;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].includes("🎬")) {
      markerIndex = i;
      break;
    }
  }
  if (markerIndex === -1) return { history: [], latest: log };
  return { history: log.slice(0, markerIndex), latest: log.slice(markerIndex) };
}

export function BattleLog({ log }: { log: string[] }) {
  const { history, latest } = splitLatestRound(log);
  const revealedLatest = useStaggeredLines(latest);
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div>
      <div className="battle-log-latest">
        {revealedLatest.length ? (
          revealedLatest.map((line, i) => (
            <div key={i} className="battle-log-line">
              {line}
            </div>
          ))
        ) : (
          <span style={{ color: "var(--text-dim)" }}>まだ行動はありません。</span>
        )}
      </div>

      {history.length > 0 && (
        <div style={{ marginTop: "0.6rem" }}>
          <button type="button" className="btn" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? "過去のログを隠す" : `過去のログを見る(${history.length}件)`}
          </button>
          {showHistory && (
            <div className="battle-log" style={{ marginTop: "0.5rem" }}>
              {history.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
