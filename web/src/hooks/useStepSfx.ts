import { useEffect, useRef } from "react";
import { pickSfxForLogLines } from "../lib/audio";
import { useAudio } from "../lib/audio-context";

/** ラウンド再生が1手進むたびに、そのログ行の内容から効果音を推定して鳴らす。 */
export function useStepSfx(log: string[] | undefined, previousLogCount: number, visibleLogCount: number) {
  const { playSfx } = useAudio();
  const lastPlayedAtRef = useRef(-1);

  useEffect(() => {
    if (!log) return;
    if (visibleLogCount <= lastPlayedAtRef.current) return;
    lastPlayedAtRef.current = visibleLogCount;

    const newLines = log.slice(previousLogCount, visibleLogCount);
    if (newLines.length === 0) return;
    const key = pickSfxForLogLines(newLines);
    if (key) playSfx(key);
  }, [log, previousLogCount, visibleLogCount, playSfx]);
}
