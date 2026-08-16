import { useEffect } from "react";
import { BgmKey } from "../lib/audio";
import { useAudio } from "../lib/audio-context";

/** マウント中はkeyのBGMを再生し、アンマウント時にrestoreKey(既定: ロビーBGM)へ戻す。 */
export function useBgm(key: BgmKey, restoreKey: BgmKey | null = "lobby") {
  const { playBgm } = useAudio();

  useEffect(() => {
    playBgm(key);
    return () => {
      playBgm(restoreKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
