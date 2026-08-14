export const NATIONALITIES: string[] = [
  "日本人", "フランス人", "ブラジル人", "エジプト人", "ロシア人", "メキシコ人",
  "ドイツ人", "イタリア人", "韓国人", "タイ人", "スペイン人", "カナダ人",
  "オーストラリア人", "ケニア人", "アルゼンチン人", "スウェーデン人", "トルコ人",
  "ベトナム人", "モロッコ人", "インド人", "アイスランド人", "フィンランド人",
  "モンゴル人", "北朝鮮人", "ニュージーランド人",
];

export const GENDERS: string[] = ["男性", "女性"];

export const FEATURES: string[] = [
  "天才肌", "超ポジティブ", "人見知り", "リーダー気質", "料理が得意",
  "運動神経抜群", "ゲーム好き", "音楽好き", "読書家", "冒険好き", "朝が苦手",
  "夜型人間", "記憶力が高い", "方向音痴", "負けず嫌い", "マイペース",
  "コミュ力が高い", "謎が多い", "几帳面", "自由人", "何事にも全力",
  "なぜか運がいい", "よく寝る", "好奇心旺盛", "飽きっぽい",
];

export const SECRET_FEATURES: string[] = [
  "実は未来が見える", "一度見たものを忘れない", "運命を少しだけ変えられる",
  "異常な集中力を持つ", "なぜか重要人物に好かれる", "ピンチになると能力が覚醒する",
  "まだ誰にも知られていない才能がある", "人生で一度だけ奇跡を起こす",
  "存在そのものがレア", "本人だけが知らない秘密がある",
];

export type SpecialType = "attack" | "heal" | "shield" | "debuff";

export interface SpecialTypeInfo {
  emoji: string;
  label: string;
  desc: string;
}

export const HEAL_SPECIAL_PERCENT_PVP = 0.5;
export const HEAL_SPECIAL_PERCENT_RAID = 0.3;

export const SPECIAL_TYPES: Record<SpecialType, SpecialTypeInfo> = {
  attack: { emoji: "🔥", label: "攻撃型", desc: "1.8倍の大ダメージを与える。" },
  heal: {
    emoji: "💚",
    label: "回復型",
    desc: `バトル: 自分のHPを${Math.round(HEAL_SPECIAL_PERCENT_PVP * 100)}%回復。 レイド: 味方全員のHPを${Math.round(HEAL_SPECIAL_PERCENT_RAID * 100)}%回復。`,
  },
  shield: { emoji: "🛡️", label: "盾型", desc: "2ラウンドの間、被ダメージを完全に無効化する。" },
  debuff: { emoji: "💀", label: "弱体型", desc: "相手(またはボス)の攻撃力を2ラウンドの間低下させる。" },
};

export const SPECIAL_TYPE_ORDER: SpecialType[] = ["attack", "heal", "shield", "debuff"];

/** 隠し特徴の文字列から決定的にとくぎ属性を割り当てる(旧データ互換用の簡易ハッシュ) */
export function defaultSpecialTypeFor(secretFeature: string): SpecialType {
  let hash = 0;
  for (let i = 0; i < secretFeature.length; i++) {
    hash = (hash * 31 + secretFeature.charCodeAt(i)) | 0;
  }
  const idx = ((hash % SPECIAL_TYPE_ORDER.length) + SPECIAL_TYPE_ORDER.length) % SPECIAL_TYPE_ORDER.length;
  return SPECIAL_TYPE_ORDER[idx];
}

export interface FeatureStatBonus {
  hp?: number;
  atk?: number;
  def?: number;
  spd?: number;
  luck?: number;
}

export const FEATURE_STAT_BONUS: Record<string, FeatureStatBonus> = {
  天才肌: { atk: 5, def: 3 },
  超ポジティブ: { hp: 10 },
  人見知り: { def: 2 },
  リーダー気質: { atk: 3, def: 3 },
  料理が得意: { hp: 5 },
  運動神経抜群: { spd: 8, atk: 4 },
  ゲーム好き: { spd: 3 },
  音楽好き: { def: 2 },
  読書家: { def: 4 },
  冒険好き: { atk: 4, spd: 3 },
  朝が苦手: { spd: -3 },
  夜型人間: { spd: 2 },
  記憶力が高い: { def: 5 },
  方向音痴: { spd: -4 },
  負けず嫌い: { atk: 6 },
  マイペース: { def: 3 },
  コミュ力が高い: { hp: 6 },
  謎が多い: { atk: 3, def: 3 },
  几帳面: { def: 4 },
  自由人: { spd: 4 },
  何事にも全力: { atk: 6, spd: 2 },
  なぜか運がいい: { luck: 15 },
  よく寝る: { hp: 8 },
  好奇心旺盛: { spd: 3 },
  飽きっぽい: { spd: -2 },
};
