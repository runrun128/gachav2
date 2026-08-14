import { STEP_REPLAY_MS } from "@identity-slot/game-core";
import { useEffect, useRef, useState } from "react";

interface ReplayState<TStep> {
  visibleLogCount: number;
  previousLogCount: number;
  activeStep: TStep | null;
}

/**
 * ラウンドが解決されて log が伸びた時、いきなり最終結果を表示せず
 * サーバーから渡された steps を約3.2秒間隔で1手ずつ再生する。
 * previousLogCount〜visibleLogCount が「今まさに表示すべき1手分のメッセージ」の範囲になる。
 * 初回マウント時(再接続・resume)はアニメーションなしで即座に最新状態を表示する。
 *
 * 新ラウンド検知(1手目への切り替え)はレンダー中に同期的に行う。
 * これをuseEffect経由にすると、呼び出し元(RaidRoomPage等)のstate更新コミットと
 * このフックのactiveStep更新コミットが別コミットに分かれてしまい、その間の一瞬
 * (新しいstate.fighters.hp + 古いactiveStepという不整合な組み合わせ)がFighterVitals側の
 * useEffectに見えてしまうことがあった。これが「攻撃すると自分のHPに+表示が出る」不具合の原因。
 */
export function useRoundReplay<TStep extends { upToLine: number }>(
  logLength: number,
  steps: TStep[] | undefined
): ReplayState<TStep> {
  const [state, setState] = useState<ReplayState<TStep>>({
    visibleLogCount: logLength,
    previousLogCount: logLength,
    activeStep: null,
  });
  const lastLogLengthRef = useRef(logLength);
  const relevantStepsRef = useRef<TStep[]>([]);
  const timersRef = useRef<number[]>([]);

  if (logLength !== lastLogLengthRef.current) {
    const grew = logLength > lastLogLengthRef.current;
    const startCount = lastLogLengthRef.current;
    const relevantSteps = grew && steps ? steps.filter((s) => s.upToLine <= logLength) : [];
    lastLogLengthRef.current = logLength;
    relevantStepsRef.current = relevantSteps;

    if (relevantSteps.length === 0) {
      setState({ visibleLogCount: logLength, previousLogCount: logLength, activeStep: null });
    } else {
      setState({
        visibleLogCount: relevantSteps[0].upToLine,
        previousLogCount: startCount,
        activeStep: relevantSteps[0],
      });
    }
  }

  useEffect(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];

    const relevantSteps = relevantStepsRef.current;
    if (relevantSteps.length <= 1) return;

    relevantSteps.slice(1).forEach((step, i) => {
      const previousStep = relevantSteps[i];
      const t = window.setTimeout(() => {
        setState({ visibleLogCount: step.upToLine, previousLogCount: previousStep.upToLine, activeStep: step });
      }, STEP_REPLAY_MS * (i + 1));
      timersRef.current.push(t);
    });

    const finalTimer = window.setTimeout(
      () => {
        setState({ visibleLogCount: logLength, previousLogCount: logLength, activeStep: null });
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
