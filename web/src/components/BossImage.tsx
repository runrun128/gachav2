import { useState } from "react";

interface BossImageProps {
  bossKey: string;
  emoji: string;
  alt: string;
  size?: number;
}

/**
 * /public/bosses/{bossKey}.png があればそれを表示し、無ければ絵文字にフォールバックする。
 * 画像は運営が用意して差し替える想定。
 */
export function BossImage({ bossKey, emoji, alt, size = 64 }: BossImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span style={{ fontSize: size * 0.7, lineHeight: 1, display: "inline-block" }} role="img" aria-label={alt}>
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={`/bosses/${bossKey}.png`}
      alt={alt}
      style={{ width: size, height: size, objectFit: "contain", borderRadius: 10, display: "block" }}
      onError={() => setFailed(true)}
    />
  );
}
