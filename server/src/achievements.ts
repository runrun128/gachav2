export type Achievement = {
  id: string;
  name: string;
  description: string;
  title: string;
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_gacha",
    name: "はじめてのガチャ",
    description: "ガチャを1回引く",
    title: "ガチャ初心者",
  },
  {
    id: "gacha_10",
    name: "ガチャ初心者",
    description: "ガチャを10回引く",
    title: "ガチャ好き",
  },
  {
    id: "gacha_100",
    name: "ガチャ中毒",
    description: "ガチャを100回引く",
    title: "ガチャの達人",
  },
  {
    id: "ssr_1",
    name: "はじめてのSSR",
    description: "SSRを1体入手する",
    title: "SSRハンター",
  },
  {
    id: "ssr_10",
    name: "SSRコレクター",
    description: "SSRを10体入手する",
    title: "SSRコレクター",
  },
  {
    id: "battle_1",
    name: "初勝利",
    description: "PvPで1回勝つ",
    title: "新人戦士",
  },
  {
    id: "battle_10",
    name: "戦士",
    description: "PvPで10回勝つ",
    title: "ベテラン戦士",
  },
  {
    id: "raid_1",
    name: "初めての討伐",
    description: "レイドボスを1体倒す",
    title: "新人ハンター",
  },
  {
    id: "raid_10",
    name: "ボスハンター",
    description: "レイドボスを10体倒す",
    title: "ボスハンター",
  },
  {
    id: "achievement_10",
    name: "実績マスター",
    description: "実績を10個解除する",
    title: "実績マスター",
  },
];
