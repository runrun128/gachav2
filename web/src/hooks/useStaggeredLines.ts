import { useEffect, useRef, useState } from "react";

/**
 * ログ配列を1行ずつ時間差で表示する。既存のログ(マウント時・再接続時)は即時全表示し、
 * その後に増えた分だけアニメーション表示することで、戦闘の流れを追いやすくする。
 */
export function useStaggeredLines(lines: string[], delayMs = 260): string[] {
  const [revealedCount, setRevealedCount] = useState(lines.length);
  const prevLengthRef = useRef(lines.length);

  useEffect(() => {
    if (lines.length <= prevLengthRef.current) {
      setRevealedCount(lines.length);
    }
    prevLengthRef.current = lines.length;
  }, [lines.length]);

  useEffect(() => {
    if (revealedCount >= lines.length) return;
    const t = setTimeout(() => setRevealedCount((c) => Math.min(lines.length, c + 1)), delayMs);
    return () => clearTimeout(t);
  }, [revealedCount, lines.length, delayMs]);

  return lines.slice(0, revealedCount);
}
