import {
  ATK_DEBUFF_MULT,
  ATK_DEBUFF_ROUNDS,
  BURN_DAMAGE_PERCENT,
  GAMBLE_COOLDOWN_ROUNDS,
  GAMBLE_RECOIL_PERCENT,
  GAMBLE_SUCCESS_CHANCE,
  HEAL_SPECIAL_PERCENT_PVP,
  ITEMS,
  SPECIAL_ATTACK_MULTIPLIER,
  SPECIAL_COOLDOWN_ROUNDS,
  SPECIAL_SHIELD_ROUNDS,
  SPECIAL_TYPES,
  levelCooldownReduction,
} from "@identity-slot/game-core";
import {
  ATTACK_QUOTES,
  DEFEND_QUOTES,
  GAMBLE_FAIL_QUOTES,
  GAMBLE_SUCCESS_QUOTE,
  SPECIAL_QUOTES,
  buildFighter,
  computeDamage,
  defenseMultiplier,
  pick,
} from "../battle/engine";
import { BattleFighter } from "../battle/types";
import { RoyaleRoom, RoyaleRoundStep } from "./types";

export const buildRoyaleFighter = buildFighter;

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function aliveParticipantIds(room: RoyaleRoom): string[] {
  return room.participantIds.filter((pid) => (room.fighters[pid]?.hp ?? 0) > 0);
}

function snapshot(room: RoyaleRoom, actorId: string): RoyaleRoundStep {
  const participantHp: Record<string, number> = {};
  for (const pid of room.participantIds) {
    const f = room.fighters[pid];
    if (f) participantHp[pid] = Math.max(0, f.hp);
  }
  return { upToLine: room.log.length, participantHp, actorId };
}

/** 生存中で本人以外の対象を選ぶ。指定targetIdが既に脱落していれば別の生存者に差し替える。 */
function resolveTargetId(room: RoyaleRoom, actorId: string, requested: string | undefined): string | null {
  const alive = aliveParticipantIds(room).filter((pid) => pid !== actorId);
  if (alive.length === 0) return null;
  if (requested && alive.includes(requested)) return requested;
  return pickOne(alive);
}

function resolveGambleVsTarget(actor: BattleFighter, target: BattleFighter, targetDefMult: number): string[] {
  actor.gambleCooldown = Math.max(1, GAMBLE_COOLDOWN_ROUNDS - levelCooldownReduction(actor.level));

  if (targetDefMult <= 0) {
    return [`💀 ${actor.displayName} が一か八かの一撃を放つも、${target.displayName} のお守りに阻まれた!`];
  }

  if (Math.floor(Math.random() * 100) + 1 <= GAMBLE_SUCCESS_CHANCE) {
    target.hp = 0;
    return [
      `💀 ${actor.displayName} の一か八かの一撃が決まった! ${GAMBLE_SUCCESS_QUOTE}`,
      `${target.displayName} を一撃で沈めた!!`,
    ];
  }

  const { damage } = computeDamage(actor.atk, target.def, 0.4, targetDefMult, actor.luck, false);
  target.hp -= damage;
  const recoil = Math.round(actor.maxHp * GAMBLE_RECOIL_PERCENT);
  actor.hp = Math.max(0, actor.hp - recoil);

  return [
    `💀 ${actor.displayName} の一か八かの一撃…不発。${pick(GAMBLE_FAIL_QUOTES)} ` +
      `${target.displayName} に ${damage} ダメージ、反動で自分も ${recoil} ダメージを受けた。`,
  ];
}

function resolveItemEffect(itemKey: string, actor: BattleFighter, target: BattleFighter, targetDefMult: number): string[] {
  const item = ITEMS[itemKey];
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
      const { damage, crit } = computeDamage(actor.atk, target.def, item.value, targetDefMult, actor.luck);
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
      const { damage, crit } = computeDamage(actor.atk, target.def, item.value, targetDefMult, actor.luck);
      target.hp -= damage;
      actor.hp = actor.maxHp;
      return [
        `${label} — ${actor.displayName}!${crit ? " 会心の一撃!" : ""} ${target.displayName} に ${damage} ダメージ!自分のHPも全回復した!`,
      ];
    }
    case "extra_turn": {
      const { damage, crit } = computeDamage(actor.atk, target.def, 1.0, targetDefMult, actor.luck);
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

const SELF_ONLY_ITEM_EFFECTS = new Set(["heal", "invincible_1", "invincible_n", "shield_partial_1"]);

/** 1ラウンド分の全参加者の行動を速度順に解決する。乱戦(バトルロイヤル)版 resolveRound。 */
export function resolveRoyaleRound(room: RoyaleRoom): { steps: RoyaleRoundStep[]; decided: boolean } {
  const acting = aliveParticipantIds(room);
  const steps: RoyaleRoundStep[] = [];

  for (const pid of acting) {
    if (!room.pending[pid]) {
      const others = acting.filter((id) => id !== pid);
      room.pending[pid] = others.length ? { type: "attack", targetId: pickOne(others) } : { type: "defend" };
    }
  }

  let order = [...acting].sort((a, b) => room.fighters[b]!.spd - room.fighters[a]!.spd);
  const featherIds = acting.filter((pid) => {
    const act = room.pending[pid];
    return act?.type === "item" && act.itemKey && ITEMS[act.itemKey]?.effect === "priority_attack";
  });
  if (featherIds.length) {
    order = [...featherIds, ...order.filter((pid) => !featherIds.includes(pid))];
  }

  for (const pid of acting) {
    const f = room.fighters[pid]!;
    if (f.specialCooldown > 0) f.specialCooldown -= 1;
    if (f.gambleCooldown > 0) f.gambleCooldown -= 1;
    if (f.invincibleRounds > 0) f.invincibleRounds -= 1;
    if (f.shieldPartialRounds > 0) f.shieldPartialRounds -= 1;
    if (f.poisonRounds > 0 && f.hp > 0) {
      const dmg = Math.round(f.maxHp * BURN_DAMAGE_PERCENT);
      f.hp -= dmg;
      f.poisonRounds -= 1;
      room.log.push(`🕷️ ${f.displayName} は毒で ${dmg} ダメージ!`);
    }
    if (f.atkDebuffRounds > 0) f.atkDebuffRounds -= 1;
  }

  room.log.push(`🎬 ラウンド${room.roundNo} 行動開始……`);

  for (const pid of order) {
    const actor = room.fighters[pid]!;
    if (actor.hp <= 0) continue;
    if (aliveParticipantIds(room).length <= 1) break;

    const action = room.pending[pid]!;

    try {
      if (action.type === "defend") {
        const heal = Math.round(actor.maxHp * 0.08);
        actor.hp = Math.min(actor.maxHp, actor.hp + heal);
        room.log.push(`🛡️ ${actor.displayName} は防御の構え。${pick(DEFEND_QUOTES)}`);
        room.log.push(`　→ HPが${heal}回復した。`);
        continue;
      }

      if (action.type === "item" && action.itemKey) {
        const isSelfOnly = SELF_ONLY_ITEM_EFFECTS.has(ITEMS[action.itemKey]?.effect ?? "");
        if (isSelfOnly) {
          room.log.push(...resolveItemEffect(action.itemKey, actor, actor, 1));
        } else {
          const targetId = resolveTargetId(room, pid, action.targetId);
          if (!targetId) continue;
          const target = room.fighters[targetId]!;
          const targetDefMult = defenseMultiplier(target, room.pending[targetId]);
          room.log.push(...resolveItemEffect(action.itemKey, actor, target, targetDefMult));
        }
        continue;
      }

      if (action.type === "gamble") {
        const targetId = resolveTargetId(room, pid, action.targetId);
        if (!targetId) continue;
        const target = room.fighters[targetId]!;
        const targetDefMult = defenseMultiplier(target, room.pending[targetId]);
        room.log.push(`💀 ${actor.displayName} が一か八かの一撃を放つ……!`);
        room.log.push(...resolveGambleVsTarget(actor, target, targetDefMult));
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

        const targetId = resolveTargetId(room, pid, action.targetId);
        if (!targetId) continue;
        const target = room.fighters[targetId]!;
        const targetDefMult = defenseMultiplier(target, room.pending[targetId]);

        if (stype === "debuff") {
          target.atkDebuffRounds = Math.max(target.atkDebuffRounds, ATK_DEBUFF_ROUNDS);
          room.log.push(`　→ ${target.displayName} の攻撃力を${ATK_DEBUFF_ROUNDS}ラウンドの間下げた!`);
          continue;
        }

        const { damage, crit } = computeDamage(atkValue, target.def, SPECIAL_ATTACK_MULTIPLIER, targetDefMult, actor.luck);
        target.hp -= damage;
        room.log.push(`　→ ${crit ? "会心の一撃! " : ""}${target.displayName} に ${damage} ダメージ!`);
        continue;
      }

      const targetId = resolveTargetId(room, pid, action.targetId);
      if (!targetId) continue;
      const target = room.fighters[targetId]!;
      room.log.push(`⚔️ ${actor.displayName} のこうげき! ${pick(ATTACK_QUOTES)}(${target.displayName} を狙う)`);
      const targetDefMult = defenseMultiplier(target, room.pending[targetId]);
      const { damage, crit } = computeDamage(atkValue, target.def, 1.0, targetDefMult, actor.luck);
      target.hp -= damage;
      room.log.push(`　→ ${crit ? "会心の一撃! " : ""}${target.displayName} に ${damage} ダメージ!`);
    } finally {
      // 脱落判定(このターンで初めてHPが0以下になった相手を記録する)
      for (const otherId of room.participantIds) {
        const f = room.fighters[otherId];
        if (f && f.hp <= 0 && !room.eliminationOrder.includes(otherId)) {
          room.eliminationOrder.push(otherId);
          room.log.push(`⚰️ ${f.displayName} が脱落した!`);
        }
      }
      steps.push(snapshot(room, pid));
    }
  }

  const alive = aliveParticipantIds(room);
  return { steps, decided: alive.length <= 1 };
}
