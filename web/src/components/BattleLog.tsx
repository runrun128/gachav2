import { useState } from "react";

/** ラウンド開始マーカーはヘッダー側で表示済みなので、メッセージ欄には出さない */
function stripRoundMarker(lines: string[]): string[] {
  return lines.filter((line) => !line.includes("🎬"));
}

export function BattleLog({
  log,
  visibleLogCount,
  previousLogCount,
}: {
  log: string[];
  visibleLogCount: number;
  previousLogCount: number;
}) {
  const [showHistory, setShowHistory] = useState(false);

  const visible = log.slice(0, visibleLogCount);
  const currentSegment = stripRoundMarker(log.slice(previousLogCount, visibleLogCount));
  // 直前の1手にメッセージが無い(ラウンド開始マーカーのみ等)場合は、それまでの最後の行を出し続ける
  const fallback = currentSegment.length === 0 ? stripRoundMarker(visible).slice(-2) : [];
  const message = currentSegment.length > 0 ? currentSegment : fallback;
  const history = visible.slice(0, previousLogCount);

  return (
    <div>
      <div className="pokemon-message-box" key={`${previousLogCount}-${visibleLogCount}`}>
        {message.length ? (
          message.map((line, i) => <p key={i}>{line}</p>)
        ) : (
          <p style={{ opacity: 0.6 }}>まだ行動はありません。</p>
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
