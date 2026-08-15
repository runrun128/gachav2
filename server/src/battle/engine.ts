import {
  ATK_DEBUFF_MULT,
  ATK_DEBUFF_ROUNDS,
  BURN_DAMAGE_PERCENT,
  DEFEND_DAMAGE_MULT,
  DEFEND_HEAL_PERCENT,
  FEATURE_STAT_BONUS,
  GAMBLE_COOLDOWN_ROUNDS,
  GAMBLE_RECOIL_PERCENT,
  GAMBLE_SUCCESS_CHANCE,
  HEAL_SPECIAL_PERCENT_PVP,
  ITEMS,
  RARITY_BASE_STATS,
  Rarity,
  SPECIAL_ATTACK_MULTIPLIER,
  SPECIAL_COOLDOWN_ROUNDS,
  SPECIAL_SHIELD_ROUNDS,
  SPECIAL_TYPES,
  SpecialType,
  defaultSpecialTypeFor,
  levelCooldownReduction,
  levelStatMultiplier,
} from "@identity-slot/game-core";
import { BattleFighter, BattleRoom, PendingAction, RoundStep } from "./types";

export const ATTACK_QUOTES = [
  "「その程度か!?」", "「これで終わりだ!」", "「まだまだこれから!」",
  "「本気を見せてやる!」", "「逃がさない!」", "「覚悟しろ!」",
  "「甘い!」", "「食らえ!」", "「これが私の全力だ!」", "「勝負あり!」",
  "「そこまでだ!」", "「一撃で決める!」",
];

export const SPECIAL_QUOTES = [
  "「これが…私の切り札だ!」", "「隠していた力、見せてやる!」",
  "「終わりにしよう。」", "「全力全開!」", "「もう止まらない!」",
  "「これが本当の力だ!」", "「見せてやる、この一撃を!」",
];

export const DEFEND_QUOTES = [
  "「まだまだ!」", "「その程度で崩れはしない!」", "「守り抜く!」",
  "「これしきで倒れるものか!」",
];

export const GAMBLE_SUCCESS_QUOTE = "「これで…終わりだッ!!」";
export const GAMBLE_FAIL_QUOTES = ["「くっ…外した!」", "「まだまだ…!」", "「次こそは!」", "「惜しい…!」"];

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface CharacterLike {
  id: string;
  nationality: string;
  age: number;
  gender: string;
  feature: string;
  rarity: string;
  secretFeature: string | null;
  specialType: string | null;
  level: number;
}

export function buildFighter(character: CharacterLike, userId: string, displayName: string): BattleFighter {
  const rarity = character.rarity as Rarity;
  const base = RARITY_BASE_STATS[rarity];
  const bonus = FEATURE_STAT_BONUS[character.feature] ?? {};
  const levelMult = levelStatMultiplier(character.level);
  const maxHp = Math.round((base.hp + (bonus.hp ?? 0)) * levelMult);
  const hasSpecial = !!character.secretFeature;
  let specialType = character.specialType as SpecialType | null;
  if (hasSpecial && !specialType) specialType = defaultSpecialTypeFor(character.secretFeature!);

  return {
    userId,
    displayName,
    characterId: character.id,
    nationality: character.nationality,
    age: character.age,
    gender: character.gender,
    feature: character.feature,
    rarity,
    level: character.level,
    maxHp,
    hp: maxHp,
    atk: Math.round((base.atk + (bonus.atk ?? 0)) * levelMult),
    def: Math.round((base.def + (bonus.def ?? 0)) * levelMult),
    spd: Math.round((base.spd + (bonus.spd ?? 0)) * levelMult),
    luck: bonus.luck ?? 0,
    hasSpecial,
    specialType: hasSpecial ? specialType : null,
    moveName: character.secretFeature ?? "とくぎ",
    specialCooldown: 0,
    hasGamble: !hasSpecial,
    gambleCooldown: 0,
    atkDebuffRounds: 0,
    invincibleRounds: 0,
    shieldPartialRounds: 0,
    shieldPartialValue: 0,
    poisonRounds: 0,
    retired: false,
  };
}

export interface DamageResult {
  damage: number;
  crit: boolean;
}

export function computeDamage(
  atk: number,
  def: number,
  multiplier: number,
  defenseMult: number,
  luck: number,
  allowCrit = true
): DamageResult {
  if (defenseMult <= 0) return { damage: 0, crit: false };
  const scaledAtk = atk * multiplier;
  const mitigation = 100 / (100 + def);
  const base = scaledAtk * mitigation;
  let dmg = base * (0.8 + Math.random() * 0.4);
  const crit = allowCrit && Math.floor(Math.random() * 100) + 1 <= 10 + luck;
  if (crit) dmg *= 1.4;
  dmg *= defenseMult;
  return { damage: Math.max(1, Math.round(dmg)), crit };
}

export function defenseMultiplier(fighter: BattleFighter, pendingAction: PendingAction | undefined): number {
  if (fighter.invincibleRounds > 0) return 0;
  if (fighter.shieldPartialRounds > 0) return Math.max(0, 1 - fighter.shieldPartialValue);
  if (pendingAction?.type === "defend") return DEFEND_DAMAGE_MULT;
  if (pendingAction?.type === "item" && pendingAction.itemKey) {
    const item = ITEMS[pendingAction.itemKey];
    if (item?.effect === "invincible_1" || item?.effect === "invincible_n") return 0;
    if (item?.effect === "shield_partial_1") return Math.max(0, 1 - item.value);
  }
  return 1;
}

function resolveGamble(actor: BattleFighter, target: BattleFighter, targetDefenseMult: number): string[] {
  actor.gambleCooldown = Math.max(1, GAMBLE_COOLDOWN_ROUNDS - levelCooldownReduction(actor.level));

  if (targetDefenseMult <= 0) {
    return [`💀 ${actor.displayName} が一か八かの一撃を放つも、相手のお守りに阻まれた!`];
  }

  if (Math.floor(Math.random() * 100) + 1 <= GAMBLE_SUCCESS_CHANCE) {
    target.hp = 0;
    return [
      `💀 ${actor.displayName} の一か八かの一撃が決まった! ${GAMBLE_SUCCESS_QUOTE}`,
      `${target.displayName} を一撃で沈めた!!`,
    ];
  }

  const { damage } = computeDamage(actor.atk, target.def, 0.4, targetDefenseMult, actor.luck, false);
  target.hp -= damage;
  const recoil = Math.round(actor.maxHp * GAMBLE_RECOIL_PERCENT);
  actor.hp = Math.max(0, actor.hp - recoil);

  return [
    `💀 ${actor.displayName} の一か八かの一撃…不発。${pick(GAMBLE_FAIL_QUOTES)} ` +
      `${target.displayName} に ${damage} ダメージ、反動で自分も ${recoil} ダメージを受けた。`,
  ];
}

function resolveItemEffect(
  itemKey: string,
  actor: BattleFighter,
  target: BattleFighter,
  targetDefenseMult: number
): string[] {
  const item = ITEMS[itemKey];
  // 使用を選択した後〜ラウンド解決までの間に運営がアイテムを削除した場合(期間限定アイテム等)、
  // 効果は不発として扱いクラッシュしないようにする。
  if (!item) return [`🌫️ ${actor.displayName} が使おうとしたアイテムは、すでに失われていた……`];
  const label = `${item.emoji} ${item.name}`;

  switch (item.effect) {
    case "heal": {
      const heal = Math.round(actor.maxHp * item.value);
      actor.hp = Math.min(actor.maxHp, actor.hp + heal);
      return [`${label} — ${actor.displayName} が使った!HPが${heal}回復した。`];
    }
    case "attack_multiplier":
    case "priority_attack": {
      const { damage, crit } = computeDamage(actor.atk, target.def, item.value, targetDefenseMult, actor.luck);
      target.hp -= damage;
      return [`${label} — ${actor.displayName}!${crit ? " 会心の一撃!" : ""} ${target.displayName} に ${damage} ダメージ!`];
    }
    case "invincible_1":
    case "invincible_n": {
      const rounds = Math.trunc(item.value);
      actor.invincibleRounds = Math.max(actor.invincibleRounds, rounds);
      return [`${label} — ${actor.displayName} が使った!${rounds}ラウンドの間、被ダメージを無効化する。`];
    }
    case "shield_partial_1": {
      actor.shieldPartialRounds = Math.max(actor.shieldPartialRounds, 1);
      actor.shieldPartialValue = item.value;
      return [`${label} — ${actor.displayName} が使った!このラウンドの被ダメージを${Math.round(item.value * 100)}%軽減する。`];
    }
    case "enemy_atk_down": {
      target.atkDebuffRounds = Math.max(target.atkDebuffRounds, Math.trunc(item.value) || ATK_DEBUFF_ROUNDS);
      return [`${label} — ${actor.displayName} が使った!${target.displayName} の攻撃力が下がった。`];
    }
    case "poison": {
      target.poisonRounds = Math.max(target.poisonRounds, Math.trunc(item.value));
      return [`${label} — ${actor.displayName} が使った!${target.displayName} は毒状態になった。`];
    }
    case "nuke_and_full_heal": {
      const { damage, crit } = computeDamage(actor.atk, target.def, item.value, targetDefenseMult, actor.luck);
      target.hp -= damage;
      actor.hp = actor.maxHp;
      return [
        `${label} — ${actor.displayName}!${crit ? " 会心の一撃!" : ""} ${target.displayName} に ${damage} ダメージ!自分のHPも全回復した!`,
      ];
    }
    case "extra_turn": {
      const { damage, crit } = computeDamage(actor.atk, target.def, 1.0, targetDefenseMult, actor.luck);
      target.hp -= damage;
      return [
        `${label} — ${actor.displayName} が使った!時が歪み、もう一度行動する!`,
        `　→ 追加行動!${crit ? "会心の一撃! " : ""}${target.displayName} に ${damage} ダメージ!`,
      ];
    }
    default:
      return [`${label} — ${actor.displayName} が使った。`];
  }
}

export function resolveRound(room: BattleRoom): RoundStep[] {
  const [p1, p2] = room.userIds;
  const f1 = room.fighters[p1]!;
  const f2 = room.fighters[p2]!;
  const steps: RoundStep[] = [];

  if (!room.pending[p1]) room.pending[p1] = { type: "attack" };
  if (!room.pending[p2]) room.pending[p2] = { type: "attack" };

  let order: [string, string] = f1.spd >= f2.spd ? [p1, p2] : [p2, p1];

  const priorityId = [p1, p2].find((pid) => {
    const act = room.pending[pid];
    if (act?.type !== "item" || !act.itemKey) return false;
    return ITEMS[act.itemKey]?.effect === "priority_attack";
  });
  if (priorityId) {
    order = [priorityId, priorityId === p1 ? p2 : p1];
  }

  for (const pid of [p1, p2]) {
    const f = room.fighters[pid]!;
    if (f.specialCooldown > 0) f.specialCooldown -= 1;
    if (f.gambleCooldown > 0) f.gambleCooldown -= 1;
    if (f.poisonRounds > 0 && f.hp > 0) {
      const dmg = Math.round(f.maxHp * BURN_DAMAGE_PERCENT);
      f.hp -= dmg;
      f.poisonRounds -= 1;
      room.log.push(`🕷️ ${f.displayName} は毒で ${dmg} ダメージ!`);
    }
    if (f.atkDebuffRounds > 0) f.atkDebuffRounds -= 1;
    if (f.invincibleRounds > 0) f.invincibleRounds -= 1;
    if (f.shieldPartialRounds > 0) f.shieldPartialRounds -= 1;
  }

  room.log.push(`🎬 ラウンド ${room.roundNo} 行動開始……`);

  for (const actorId of order) {
    const targetId = actorId === p1 ? p2 : p1;
    const actor = room.fighters[actorId]!;
    const target = room.fighters[targetId]!;
    if (actor.hp <= 0 || target.hp <= 0) continue;

    const action = room.pending[actorId]!;

    try {
      if (action.type === "defend") {
        const heal = Math.round(actor.maxHp * DEFEND_HEAL_PERCENT);
        actor.hp = Math.min(actor.maxHp, actor.hp + heal);
        room.log.push(`🛡️ ${actor.displayName} は防御の構え。${pick(DEFEND_QUOTES)}`);
        room.log.push(`　→ HPが${heal}回復した。`);
        continue;
      }

      if (action.type === "gamble") {
        const targetDefMult = defenseMultiplier(target, room.pending[targetId]);
        room.log.push(`💀 ${actor.displayName} が一か八かの一撃を放つ……!`);
        room.log.push(...resolveGamble(actor, target, targetDefMult));
        continue;
      }

      if (action.type === "item" && action.itemKey) {
        const targetDefMult = defenseMultiplier(target, room.pending[targetId]);
        room.log.push(...resolveItemEffect(action.itemKey, actor, target, targetDefMult));
        continue;
      }

      let atkValue = actor.atk;
      if (actor.atkDebuffRounds > 0) atkValue = Math.round(actor.atk * ATK_DEBUFF_MULT);

      if (action.type === "special") {
        const stype = actor.specialType ?? "attack";
        actor.specialCooldown = Math.max(1, SPECIAL_COOLDOWN_ROUNDS - levelCooldownReduction(actor.level));
        room.log.push(
          `${SPECIAL_TYPES[stype].emoji} ${actor.displayName} のとくぎ「${actor.moveName}」(${SPECIAL_TYPES[stype].label})! ${pick(SPECIAL_QUOTES)}`
        );

        if (stype === "heal") {
          const heal = Math.round(actor.maxHp * HEAL_SPECIAL_PERCENT_PVP);
          actor.hp = Math.min(actor.maxHp, actor.hp + heal);
          room.log.push(`　→ HPが${heal}回復した!`);
          continue;
        }
        if (stype === "shield") {
          actor.invincibleRounds = Math.max(actor.invincibleRounds, SPECIAL_SHIELD_ROUNDS);
          room.log.push(`　→ ${SPECIAL_SHIELD_ROUNDS}ラウンドの間、被ダメージを無効化する盾を展開した!`);
          continue;
        }
        if (stype === "debuff") {
          target.atkDebuffRounds = Math.max(target.atkDebuffRounds, ATK_DEBUFF_ROUNDS);
          room.log.push(`　→ ${target.displayName} の攻撃力を${ATK_DEBUFF_ROUNDS}ラウンドの間下げた!`);
          continue;
        }

        const targetDefMult = defenseMultiplier(target, room.pending[targetId]);
        const { damage, crit } = computeDamage(atkValue, target.def, SPECIAL_ATTACK_MULTIPLIER, targetDefMult, actor.luck);
        target.hp -= damage;
        room.log.push(
          `　→ ${crit ? "会心の一撃! " : ""}${target.displayName} に ${damage} ダメージ!${extraNote(targetDefMult)}`
        );
        continue;
      }

      room.log.push(`⚔️ ${actor.displayName} のこうげき! ${pick(ATTACK_QUOTES)}`);
      const targetDefMult = defenseMultiplier(target, room.pending[targetId]);
      const { damage, crit } = computeDamage(atkValue, target.def, 1.0, targetDefMult, actor.luck);
      target.hp -= damage;
      room.log.push(
        `　→ ${crit ? "会心の一撃! " : ""}${target.displayName} に ${damage} ダメージ!${extraNote(targetDefMult)}`
      );
    } finally {
      steps.push({ upToLine: room.log.length, hp: { [p1]: f1.hp, [p2]: f2.hp }, actorId });
    }
  }

  return steps;
}

function extraNote(defenseMult: number): string {
  if (defenseMult <= 0) return "(完全に無効化!)";
  if (defenseMult < 1) return "(軽減)";
  return "";
}
