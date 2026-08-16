export type IconName = "home" | "gacha" | "battle" | "raid" | "announcement" | "more" | "gem";

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

/** 下部メニュー・ガチャのレア度表示用に作った独自アイコンセット(絵文字を使わない) */
export function Icon({ name, size = 22, className }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    className,
    "aria-hidden": true,
  };

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path
            d="M4 11.5 12 4l8 7.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6 10v8.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V10"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M10 20v-5.5h4V20" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
    case "gacha":
      return (
        <svg {...common}>
          <rect x="3.5" y="6" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="8" cy="13" r="1.6" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="13" cy="13" r="1.6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M17.5 8v10a1.5 1.5 0 0 0 1.5 1.5h0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M19 6.5V19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="19" cy="6" r="1.4" fill="currentColor" />
        </svg>
      );
    case "battle":
      return (
        <svg {...common}>
          <path
            d="M4 20L14 10M14 10l-1.5-4L16 4l1.5 3L20 8.5 16 12l-4-2z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M20 20L10 10M10 10l1.5-4L8 4 6.5 7 4 8.5 8 12l2-2z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "raid":
      return (
        <svg {...common}>
          <path
            d="M12 3c2.4 1.7 3.8 4.3 3.8 7.4 0 2.9-1.5 5-3.8 7.6-2.3-2.6-3.8-4.7-3.8-7.6C8.2 7.3 9.6 4.7 12 3z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <circle cx="10.2" cy="9.6" r="0.9" fill="currentColor" />
          <circle cx="13.8" cy="9.6" r="0.9" fill="currentColor" />
          <path d="M9.5 13.2c1 .8 4 .8 5 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M7 20.5c1.6-1 3.2-1.5 5-1.5s3.4.5 5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "announcement":
      return (
        <svg {...common}>
          <path
            d="M6 10.5v3a1.5 1.5 0 0 0 1.5 1.5h.3l1.2 3.4a1 1 0 0 0 1.9-.3l-.2-3.1H13c2.8-2.2 5-2.6 5-2.6v-6s-2.2-.4-5-2.6H9c-1.7 0-3 1.3-3 3z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M18 9.5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "more":
      return (
        <svg {...common}>
          <circle cx="6" cy="12" r="1.7" fill="currentColor" />
          <circle cx="12" cy="12" r="1.7" fill="currentColor" />
          <circle cx="18" cy="12" r="1.7" fill="currentColor" />
        </svg>
      );
    case "gem":
      return (
        <svg {...common}>
          <path
            d="M7 4h10l4 5.5L12 21 3 9.5 7 4z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
            fill="currentColor"
            fillOpacity="0.18"
          />
          <path d="M3 9.5h18M9.5 4L7.8 9.5 12 21l4.2-11.5L14.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}
