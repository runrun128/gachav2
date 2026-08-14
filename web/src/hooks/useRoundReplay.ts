import { STEP_REPLAY_MS } from "@identity-slot/game-core";
import { useEffect, useRef, useState } from "react";

interface ReplayState<TStep> {
  visibleLogCount: number;
  activeStep: TStep | null;
}

/**
 * ラウンドが解決されて log が伸びた時、いきなり最終結果を表示せず
 * サーバーから渡された steps を約2秒間隔で1手ずつ再生する。
 * 初回マウント時(再接続・resume)はアニメーションなしで即座に最新状態を表示する。
 */
export function useRoundReplay<TStep extends { upToLine: number }>(
  logLength: number,
  steps: TStep[] | undefined
): ReplayState<TStep> {
  const [state, setState] = useState<ReplayState<TStep>>({ visibleLogCount: logLength, activeStep: null });
  const lastLogLengthRef = useRef(logLength);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];

    const grew = logLength > lastLogLengthRef.current;
    lastLogLengthRef.current = logLength;

    const relevantSteps = grew && steps ? steps.filter((s) => s.upToLine <= logLength) : [];

    if (relevantSteps.length === 0) {
      setState({ visibleLogCount: logLength, activeStep: null });
      return;
    }

    setState({ visibleLogCount: relevantSteps[0].upToLine, activeStep: relevantSteps[0] });

    relevantSteps.slice(1).forEach((step, i) => {
      const t = window.setTimeout(() => {
        setState({ visibleLogCount: step.upToLine, activeStep: step });
      }, STEP_REPLAY_MS * (i + 1));
      timersRef.current.push(t);
    });

    const finalTimer = window.setTimeout(
      () => {
        setState({ visibleLogCount: logLength, activeStep: null });
      },
      STEP_REPLAY_MS * relevantSteps.length
    );
    timersRef.current.push(finalTimer);

    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logLength]);

  return state;
}
