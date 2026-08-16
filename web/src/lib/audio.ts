export type SfxKey =
  | "attack"
  | "crit"
  | "heal"
  | "defend"
  | "item"
  | "special"
  | "gamble"
  | "eliminate"
  | "victory"
  | "defeat"
  | "gachaTick"
  | "gachaConfirm"
  | "gachaMega"
  | "click";

export type BgmKey = "lobby" | "battle" | "gacha";

// public/audio/ 以下にこのファイル名で音源を置くと自動的に鳴るようになる(未配置なら無音でスキップされる)。
export const SFX_FILES: Record<SfxKey, string> = {
  attack: "/audio/sfx/attack.mp3",
  crit: "/audio/sfx/crit.mp3",
  heal: "/audio/sfx/heal.mp3",
  defend: "/audio/sfx/defend.mp3",
  item: "/audio/sfx/item.mp3",
  special: "/audio/sfx/special.mp3",
  gamble: "/audio/sfx/gamble.mp3",
  eliminate: "/audio/sfx/eliminate.mp3",
  victory: "/audio/sfx/victory.mp3",
  defeat: "/audio/sfx/defeat.mp3",
  gachaTick: "/audio/sfx/gacha_tick.mp3",
  gachaConfirm: "/audio/sfx/gacha_confirm.mp3",
  gachaMega: "/audio/sfx/gacha_mega.mp3",
  click: "/audio/sfx/click.mp3",
};

export const BGM_FILES: Record<BgmKey, string> = {
  lobby: "/audio/bgm/lobby.mp3",
  battle: "/audio/bgm/battle.mp3",
  gacha: "/audio/bgm/gacha.mp3",
};

/**
 * ラウンドログの新規行から、それっぽい効果音を1つだけ推定して返す。
 * 複数当てはまる場合は「派手さ」順(会心 > 必殺技 > 一か八か > 攻撃/防御/回復/アイテム > 脱落)を優先する。
 */
export function pickSfxForLogLines(lines: string[]): SfxKey | null {
  const text = lines.join("\n");
  if (/会心/.test(text)) return "crit";
  if (/脱落|戦闘不能|討伐失敗|全滅/.test(text)) return "eliminate";
  if (/とくぎ|✨/.test(text)) return "special";
  if (/一か八か|💀/.test(text)) return "gamble";
  if (/防御の構え|🛡️/.test(text)) return "defend";
  if (/HPが.*回復/.test(text)) return "heal";
  if (/が使った/.test(text)) return "item";
  if (/こうげき|⚔️/.test(text)) return "attack";
  return null;
}
