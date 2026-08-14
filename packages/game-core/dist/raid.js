export const MAX_RAID_PARTICIPANTS = 4;
export const RAID_MAX_ROUNDS = 20;
export const RAID_WIN_REWARD = 400;
export const RAID_LOSE_REWARD = 100;
export const RAID_ITEM_DROP_CHANCE = 30; // %
export const RAID_MVP_BONUS = 200;
export const BURN_ROUNDS = 2;
export const POISON_ROUNDS = 2;
export const SILENCE_ROUNDS = 2;
export const WEAKPOINT_EVERY = 5;
export const WEAKPOINT_MULTIPLIER = 1.5;
export const BOSS_SELFHEAL_CHANCE = 15; // %
export const BOSS_SELFHEAL_PERCENT = 0.15;
export const BOSS_SHIELD_ROUNDS = 3;
export const BOSS_SHIELD_REDUCTION = 0.6;
export const RAID_ROUND_ACTION_TIMEOUT_MS = 45_000;
export const RAID_CHARACTER_SELECT_TIMEOUT_MS = 60_000;
// ラウンド結果(参加者の行動+ボスの行動)を見せてから次のラウンドを開始するまでの間
export const RAID_ROUND_INTERMISSION_MS = 3_000;
export const BOSSES = {
    gehenna: {
        key: "gehenna",
        name: "業火の悪魔ゲヘナ",
        emoji: "🔥",
        color: "#E74C3C",
        hp: 520,
        atk: 30,
        def: 18,
        spd: 14,
        desc: "3ラウンドごとに専用技「業火の咆哮」で参加者全員を攻撃する。HPが半分を切ると専用技の威力がさらに上昇する。" +
            "またランダムで「灼熱のブレス」を放ち、標的を2ラウンド火傷させる。",
        specialName: "業火の咆哮",
        attackQuotes: ["「燃え尽きろ!」", "「灰も残さぬ!」", "「その程度か?」", "「もっと苦しめ!」"],
        specialQuote: "「業火が、全てを飲み込む!!」",
        burnMoveName: "灼熱のブレス",
        burnMoveQuote: "「その身を焼き尽くせ…」",
        burnMoveChance: 20,
    },
    lilith: {
        key: "lilith",
        name: "氷結の女王リリス",
        emoji: "🧊",
        color: "#3498DB",
        hp: 460,
        atk: 26,
        def: 24,
        spd: 18,
        desc: "攻撃時、25%の確率で標的とは別の挑戦者を「凍結」させ次の行動を封じる。3ラウンドごとに専用技「絶対零度」で" +
            "単体に大ダメージ+確定凍結。ランダムで「吹雪」を放ち、2人を同時に攻撃する。",
        specialName: "絶対零度",
        attackQuotes: ["「凍りつけ。」", "「温もりごと奪ってやろう。」", "「その血、凍らせてやる。」"],
        specialQuote: "「心まで、凍らせてあげる…」",
        freezeChance: 25,
        blizzardMoveName: "吹雪",
        blizzardMoveQuote: "「まとめて凍りつくがいい…」",
        blizzardMoveChance: 22,
    },
    varga: {
        key: "varga",
        name: "深淵の竜王ヴァルガ",
        emoji: "🐉",
        color: "#8E44AD",
        hp: 650,
        atk: 26,
        def: 28,
        spd: 10,
        desc: "HPが60%を切ると「威嚇の咆哮」で全員の攻撃力を2ラウンド低下させる。HPが30%を切ると怒りに目覚め、" +
            "攻撃力が1.6倍に上昇し専用技「深淵の顎」を使うようになる。",
        specialName: "深淵の顎",
        attackQuotes: ["「矮小な者よ。」", "「消え失せろ。」", "「この程度で竜に挑むか。」"],
        specialQuote: "「我が怒り、その身で味わうがいい!!」",
        enrageThreshold: 0.3,
        enrageMultiplier: 1.6,
        roarMoveName: "威嚇の咆哮",
        roarMoveQuote: "「我が咆哮、その身に刻め…」",
        roarThreshold: 0.6,
    },
    voltex: {
        key: "voltex",
        name: "暴風の魔人ヴォルテクス",
        emoji: "🌪️",
        color: "#1ABC9C",
        hp: 500,
        atk: 27,
        def: 20,
        spd: 21,
        desc: "3ラウンドごとに専用技「連鎖雷撃」で複数の挑戦者を同時に攻撃する。HPが40%を切ると「暴風の盾」を展開し、" +
            "一定ラウンドの間受けるダメージを軽減する(1回限定)。",
        specialName: "連鎖雷撃",
        attackQuotes: ["「風に消えろ!」", "「捕まえてみせろ!」", "「これが本当の速さだ!」"],
        specialQuote: "「雷よ、全てを貫け!!」",
        shieldMoveName: "暴風の盾",
        shieldMoveQuote: "「この程度、かすり傷にもならん…」",
        shieldThreshold: 0.4,
    },
    arachne: {
        key: "arachne",
        name: "深淵の蜘蛛女王アラクネ",
        emoji: "🕷️",
        color: "#6C3483",
        hp: 480,
        atk: 24,
        def: 22,
        spd: 17,
        desc: "通常攻撃に猛毒を仕込んでおり、命中すると2ラウンドの間毒状態になる。3ラウンドごとに専用技「呪縛の糸」で" +
            "1人のとくぎ・一か八かを封じる。",
        specialName: "呪縛の糸",
        attackQuotes: ["「もがくがいい。」", "「甘い毒に沈むといい…」", "「逃がしはしない。」"],
        specialQuote: "「その力、糸で縛り上げてやろう…」",
        poisonChance: 60,
    },
    shade: {
        key: "shade",
        name: "闇の魔導士シェイド",
        emoji: "🌑",
        color: "#2C2C54",
        hp: 550,
        atk: 25,
        def: 20,
        spd: 19,
        desc: "3ラウンドごとに専用技「魂の収奪」で対象にダメージを与えつつ、その一部で自分のHPを回復する。" +
            "ランダムで「呪詛」を放ち、対象の攻撃力を2ラウンドの間低下させる。",
        specialName: "魂の収奪",
        attackQuotes: ["「闇に還るがいい。」", "「その魂、いただこう。」", "「もがけばもがくほど楽しい。」"],
        specialQuote: "「その魂、私が喰らい尽くす…」",
        drainRatio: 0.5,
        curseMoveName: "呪詛",
        curseMoveQuote: "「弱くなれ…」",
        curseMoveChance: 22,
    },
};
export const BOSS_ORDER = ["gehenna", "lilith", "varga", "voltex", "arachne", "shade"];
