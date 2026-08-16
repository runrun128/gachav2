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

export function AudioProvider({ children }: { children: ReactNode }) {
  const [muted, setMutedState] = useState(readStoredMuted);
  const [volume, setVolumeState] = useState(readStoredVolume);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgmKeyRef = useRef<BgmKey | null>(null);

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
      audio.volume = volume;
      // 音源が未配置(404)でもコンソールを汚さず静かに諦める
      audio.play().catch(() => {});
    },
    [muted, volume]
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
      audio.volume = muted ? 0 : volume;
      bgmAudioRef.current = audio;
      // 自動再生ブロック(ユーザー操作前)は無視して、次の操作後の再生に任せる
      audio.play().catch(() => {});
    },
    [muted, volume]
  );

  useEffect(() => {
    if (bgmAudioRef.current) {
      bgmAudioRef.current.volume = muted ? 0 : volume;
    }
  }, [muted, volume]);

  useEffect(() => {
    return () => {
      bgmAudioRef.current?.pause();
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
