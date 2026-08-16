import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BGM_FILES, BgmKey, SFX_FILES, SfxKey } from "./audio";

const MUTED_KEY = "audio_muted";
const VOLUME_KEY = "audio_volume";

interface AudioContextValue {
  muted: boolean;
  volume: number;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  playSfx: (key: SfxKey) => void;
  playBgm: (key: BgmKey | null) => void;
}

const AudioCtx = createContext<AudioContextValue | null>(null);

function readStoredMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

function readStoredVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0.6;
  } catch {
    return 0.6;
  }
}

type WebAudioContextCtor = typeof window.AudioContext;

export function AudioProvider({ children }: { children: ReactNode }) {
  const [muted, setMutedState] = useState(readStoredMuted);
  const [volume, setVolumeState] = useState(readStoredVolume);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgmKeyRef = useRef<BgmKey | null>(null);

  // iOS SafariはHTMLMediaElement.volume/mutedへの代入を無視する(本体の物理ボタンでしか
  // 音量調整できない仕様)。Web Audio APIのGainNodeを経由させると、この制限を回避して
  // 実際に音量・ミュートを効かせられるため、すべての再生をGainNode経由にする。
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  const getGraph = useCallback((): { ctx: AudioContext; gain: GainNode } | null => {
    const Ctor: WebAudioContextCtor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: WebAudioContextCtor }).webkitAudioContext;
    if (!Ctor) return null;
    if (!audioCtxRef.current) {
      const ctx = new Ctor();
      const gain = ctx.createGain();
      gain.gain.value = muted ? 0 : volume;
      gain.connect(ctx.destination);
      audioCtxRef.current = ctx;
      masterGainRef.current = gain;
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
    return { ctx: audioCtxRef.current, gain: masterGainRef.current! };
  }, [muted, volume]);

  /** audio要素をGainNode経由の出力に繋ぎ変える。接続後は要素自体のvolume/mutedは効かなくなる。 */
  const routeThroughGraph = useCallback(
    (audio: HTMLAudioElement) => {
      const graph = getGraph();
      if (!graph) return; // Web Audio API非対応の環境ではブラウザ標準の再生のみ行う
      try {
        const source = graph.ctx.createMediaElementSource(audio);
        source.connect(graph.gain);
      } catch {
        // 同じ要素に対して二重に呼ばれた場合など。実害はないので無視する。
      }
    },
    [getGraph]
  );

  const setMuted = useCallback((value: boolean) => {
    setMutedState(value);
    try {
      localStorage.setItem(MUTED_KEY, value ? "1" : "0");
    } catch {
      // localStorage不可(プライベートモード等)でも動作は継続する
    }
  }, []);

  const setVolume = useCallback((value: number) => {
    const clamped = Math.min(1, Math.max(0, value));
    setVolumeState(clamped);
    try {
      localStorage.setItem(VOLUME_KEY, String(clamped));
    } catch {
      // noop
    }
  }, []);

  const playSfx = useCallback(
    (key: SfxKey) => {
      if (muted) return;
      const audio = new Audio(SFX_FILES[key]);
      routeThroughGraph(audio);
      // 音源が未配置(404)でもコンソールを汚さず静かに諦める
      audio.play().catch(() => {});
    },
    [muted, routeThroughGraph]
  );

  const playBgm = useCallback(
    (key: BgmKey | null) => {
      if (bgmKeyRef.current === key) return;
      bgmKeyRef.current = key;

      if (bgmAudioRef.current) {
        bgmAudioRef.current.pause();
        bgmAudioRef.current = null;
      }
      if (!key) return;

      const audio = new Audio(BGM_FILES[key]);
      audio.loop = true;
      routeThroughGraph(audio);
      bgmAudioRef.current = audio;
      // 自動再生ブロック(ユーザー操作前)やタブが非表示中の再生ブロックは無視して、
      // 次の操作/表示復帰後の再生に任せる
      if (!document.hidden) audio.play().catch(() => {});
    },
    [routeThroughGraph]
  );

  // ミュート/音量の変更はGainNodeの値を直接書き換えるだけでよい(iOSでも確実に反映される)
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = muted ? 0 : volume;
    }
  }, [muted, volume]);

  // アプリがバックグラウンドに回った(タブ切り替え/ホーム画面に戻る/画面ロック)間はBGMを一時停止し、
  // 復帰したら再開する。スマホでバックグラウンド再生され続けて電池を消費したり、
  // ロック画面にメディア再生通知が出続けたりするのを防ぐ。
  useEffect(() => {
    function handleVisibilityChange() {
      const audio = bgmAudioRef.current;
      if (!audio) return;
      if (document.hidden) {
        audio.pause();
      } else if (!muted) {
        audio.play().catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [muted]);

  useEffect(() => {
    return () => {
      bgmAudioRef.current?.pause();
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  const value = useMemo(
    () => ({ muted, volume, setMuted, setVolume, playSfx, playBgm }),
    [muted, volume, setMuted, setVolume, playSfx, playBgm]
  );

  return <AudioCtx.Provider value={value}>{children}</AudioCtx.Provider>;
}

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error("useAudio must be used within AudioProvider");
  return ctx;
}
