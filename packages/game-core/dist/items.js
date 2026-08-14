export const ITEMS = {
    heal_potion: {
        key: "heal_potion", name: "回復ポーション", emoji: "🧪", price: 150, purchasable: true, tier: "shop",
        desc: "自分のHPを最大HPの30%回復する。", effect: "heal", value: 0.3,
    },
    power_up: {
        key: "power_up", name: "強化の粉", emoji: "💪", price: 200, purchasable: true, tier: "shop",
        desc: "1.3倍の威力でこうげきする(とくぎのクールダウンには影響しない)。", effect: "attack_multiplier", value: 1.3,
    },
    guard_charm: {
        key: "guard_charm", name: "守りのお守り", emoji: "🛡️✨", price: 150, purchasable: true, tier: "shop",
        desc: "このラウンドに受けるダメージを完全に無効化する(自分は攻撃しない)。", effect: "invincible_1", value: 1,
    },
    speed_feather: {
        key: "speed_feather", name: "素早さの羽", emoji: "🪶", price: 120, purchasable: true, tier: "shop",
        desc: "SPDに関わらず、このラウンドは必ず先制してこうげきする。", effect: "priority_attack", value: 1.0,
    },
    bone_fragment: {
        key: "bone_fragment", name: "デーモンの骨片", emoji: "🦴", purchasable: false, tier: "common",
        desc: "自分のHPを25%回復する。", effect: "heal", value: 0.25,
    },
    torn_web: {
        key: "torn_web", name: "千切れた糸", emoji: "🕸️", purchasable: false, tier: "common",
        desc: "このラウンドに受けるダメージを50%軽減する。", effect: "shield_partial_1", value: 0.5,
    },
    frozen_shard: {
        key: "frozen_shard", name: "凍てついた欠片", emoji: "❄️", purchasable: false, tier: "common",
        desc: "相手(ボス)の攻撃力を1ラウンド低下させる。", effect: "enemy_atk_down", value: 1,
    },
    gale_feather: {
        key: "gale_feather", name: "疾風の羽根", emoji: "🌪️", purchasable: false, tier: "uncommon",
        desc: "必ず先制し、1.3倍の威力でこうげきする(素早さの羽の強化版)。", effect: "priority_attack", value: 1.3,
    },
    curse_crystal: {
        key: "curse_crystal", name: "呪いの結晶", emoji: "💜", purchasable: false, tier: "uncommon",
        desc: "相手に呪いをかけ、2ラウンドの間毒状態にする。", effect: "poison", value: 2,
    },
    life_drop: {
        key: "life_drop", name: "生命の雫", emoji: "🩸", purchasable: false, tier: "uncommon",
        desc: "自分のHPを50%回復する。", effect: "heal", value: 0.5,
    },
    dragon_scale: {
        key: "dragon_scale", name: "竜の逆鱗", emoji: "⚡", purchasable: false, tier: "rare",
        desc: "2.0倍の威力で強力なこうげきをする。", effect: "attack_multiplier", value: 2.0,
    },
    absolute_barrier: {
        key: "absolute_barrier", name: "絶対障壁", emoji: "🛡️", purchasable: false, tier: "rare",
        desc: "2ラウンドの間、被ダメージを完全に無効化する。", effect: "invincible_n", value: 2,
    },
    myth_shard: {
        key: "myth_shard", name: "神話の破片", emoji: "🌈", purchasable: false, tier: "legendary",
        desc: "相手に大ダメージ(2.2倍)を与え、自分のHPを全回復する。", effect: "nuke_and_full_heal", value: 2.2,
    },
    sand_of_time: {
        key: "sand_of_time", name: "時の砂", emoji: "⏳", purchasable: false, tier: "legendary",
        desc: "このラウンド、もう一度追加で行動できる。", effect: "extra_turn", value: 1,
    },
};
export const PURCHASABLE_ITEMS = Object.values(ITEMS).filter((i) => i.purchasable);
export const BOSS_ITEM_TIER_WEIGHTS = {
    common: 50,
    uncommon: 30,
    rare: 15,
    legendary: 5,
};
/** ボス討伐時のアイテムドロップ抽選。レアな階層(tier)ほど出にくい。 */
export function chooseBossDropItem(rng = Math.random) {
    const byTier = {};
    for (const item of Object.values(ITEMS)) {
        if (item.purchasable)
            continue;
        (byTier[item.tier] ??= []).push(item.key);
    }
    const tiers = Object.keys(byTier);
    const weights = tiers.map((t) => BOSS_ITEM_TIER_WEIGHTS[t] ?? 1);
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rng() * total;
    let tier = tiers[tiers.length - 1];
    for (let i = 0; i < tiers.length; i++) {
        if (roll < weights[i]) {
            tier = tiers[i];
            break;
        }
        roll -= weights[i];
    }
    const candidates = byTier[tier];
    return candidates[Math.floor(rng() * candidates.length)];
}
