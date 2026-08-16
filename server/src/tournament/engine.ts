import {
  ATK_DEBUFF_MULT,
  ATK_DEBUFF_ROUNDS,
  DEFEND_HEAL_PERCENT,
  GAMBLE_COOLDOWN_ROUNDS,
  GAMBLE_RECOIL_PERCENT,
  GAMBLE_SUCCESS_CHANCE,
  HEAL_SPECIAL_PERCENT_PVP,
  SPECIAL_ATTACK_MULTIPLIER,
  SPECIAL_COOLDOWN_ROUNDS,
  SPECIAL_SHIELD_ROUNDS,
  SPECIAL_TYPES,
  TOURNAMENT_MAX_MATCH_ROUNDS,
  levelCooldownReduction,
} from "@identity-slot/game-core";
import { ATTACK_QUOTES, GAMBLE_FAIL_QUOTES, GAMBLE_SUCCESS_QUOTE, SPECIAL_QUOTES, buildFighter, computeDamage, pick } from "../battle/engine";
import { BattleFighter, PendingAction } from "../battle/types";

export const buildTournamentFighter = buildFighter;

/** 試合開始前にHP・クールダウン・状態異常をすべて初期値に戻したコピーを作る(前の試合の消耗を持ち越さない)。 */
export function freshFighterCopy(template: BattleFighter): BattleFighter {
  return {
    ...template,
    hp: template.maxHp,
    specialCooldown: 0,
    gambleCooldown: 0,
    atkDebuffRounds: 0,
    invincibleRounds: 0,
    shieldPartialRounds: 0,
    shieldPartialValue: 0,
    poisonRounds: 0,
    retired: false,
  };
}

type AiAction = { type: "attack" } | { type: "defend" } | { type: "special" } | { type: "gamble" };

function decideAction(actor: BattleFighter): AiAction {
  if (actor.hasGamble && actor.gambleCooldown === 0 && actor.hp < actor.maxHp * 0.35 && Math.random() < 0.4) {
    return { type: "gamble" };
  }
  if (actor.hasSpecial && actor.specialCooldown === 0 && Math.random() < 0.6) {
    return { type: "special" };
  }
  if (actor.hp < actor.maxHp * 0.3 && Math.random() < 0.3) {
    return { type: "defend" };
  }
  return { type: "attack" };
}

function toPendingAction(action: AiAction): PendingAction {
  return { type: action.type };
}

/**
 * 2人のファイターを自動シミュレーションで戦わせ、ログと勝者を返す。
 * トーナメントの各試合はライブ操作ではなく即座に決着させるため、両者ともAIが行動を選ぶ。
 */
export function simulateDuel(
  templateA: BattleFighter,
  templateB: BattleFighter
): { log: string[]; winnerId: string } {
  const a = freshFighterCopy(templateA);
  const b = freshFighterCopy(templateB);
  const log: string[] = [];

  for (let roundNo = 1; roundNo <= TOURNAMENT_MAX_MATCH_ROUNDS; roundNo++) {
    if (a.hp <= 0 || b.hp <= 0) break;

    const actionA = decideAction(a);
    const actionB = decideAction(b);
    const pendingA = toPendingAction(actionA);
    const pendingB = toPendingAction(actionB);

    if (a.specialCooldown > 0) a.specialCooldown -= 1;
    if (b.specialCooldown > 0) b.specialCooldown -= 1;
    if (a.gambleCooldown > 0) a.gambleCooldown -= 1;
    if (b.gambleCooldown > 0) b.gambleCooldown -= 1;
    if (a.atkDebuffRounds > 0) a.atkDebuffRounds -= 1;
    if (b.atkDebuffRounds > 0) b.atkDebuffRounds -= 1;

    const order: [BattleFighter, AiAction, PendingAction, BattleFighter, PendingAction][] =
      a.spd >= b.spd
        ? [
            [a, actionA, pendingA, b, pendingB],
            [b, actionB, pendingB, a, pendingA],
          ]
        : [
            [b, actionB, pendingB, a, pendingA],
            [a, actionA, pendingA, b, pendingB],
          ];

    for (const [actor, action, , target, targetPending] of order) {
      if (actor.hp <= 0 || target.hp <= 0) continue;

      if (action.type === "defend") {
        const heal = Math.round(actor.maxHp * DEFEND_HEAL_PERCENT);
        actor.hp = Math.min(actor.maxHp, actor.hp + heal);
        log.push(`🛡️ ${actor.displayName} は防御の構え。HPが${heal}回復した。`);
        continue;
      }

      if (action.type === "gamble") {
        actor.gambleCooldown = Math.max(1, GAMBLE_COOLDOWN_ROUNDS - levelCooldownReduction(actor.level));
        if (Math.floor(Math.random() * 100) + 1 <= GAMBLE_SUCCESS_CHANCE) {
          target.hp = 0;
          log.push(`💀 ${actor.displayName} の一か八かの一撃が決まった! ${GAMBLE_SUCCESS_QUOTE} ${target.displayName} を一撃で沈めた!!`);
        } else {
          const { damage } = computeDamage(actor.atk, target.def, 0.4, 1.0, actor.luck, false);
          target.hp -= damage;
          const recoil = Math.round(actor.maxHp * GAMBLE_RECOIL_PERCENT);
          actor.hp = Math.max(0, actor.hp - recoil);
          log.push(
            `💀 ${actor.displayName} の一か八かの一撃…不発。${pick(GAMBLE_FAIL_QUOTES)} ${target.displayName} に ${damage} ダメージ、反動で自分も ${recoil} ダメージ。`
          );
        }
        continue;
      }

      let atkValue = actor.atk;
      if (actor.atkDebuffRounds > 0) atkValue = Math.round(actor.atk * ATK_DEBUFF_MULT);
      const targetDefMult = targetPending.type === "defend" ? 0.55 : target.invincibleRounds > 0 ? 0 : 1;

      if (action.type === "special") {
        const stype = actor.specialType ?? "attack";
        actor.specialCooldown = Math.max(1, SPECIAL_COOLDOWN_ROUNDS - levelCooldownReduction(actor.level));
        log.push(`${SPECIAL_TYPES[stype].emoji} ${actor.displayName} のとくぎ「${actor.moveName}」! ${pick(SPECIAL_QUOTES)}`);

        if (stype === "heal") {
          const heal = Math.round(actor.maxHp * HEAL_SPECIAL_PERCENT_PVP);
          actor.hp = Math.min(actor.maxHp, actor.hp + heal);
          log.push(`　→ HPが${heal}回復した!`);
          continue;
        }
        if (stype === "shield") {
          actor.invincibleRounds = Math.max(actor.invincibleRounds, SPECIAL_SHIELD_ROUNDS);
          log.push(`　→ ${SPECIAL_SHIELD_ROUNDS}ラウンドの間、被ダメージを無効化する盾を展開した!`);
          continue;
        }
        if (stype === "debuff") {
          target.atkDebuffRounds = Math.max(target.atkDebuffRounds, ATK_DEBUFF_ROUNDS);
          log.push(`　→ ${target.displayName} の攻撃力を${ATK_DEBUFF_ROUNDS}ラウンドの間下げた!`);
          continue;
        }

        const { damage, crit } = computeDamage(atkValue, target.def, SPECIAL_ATTACK_MULTIPLIER, targetDefMult, actor.luck);
        target.hp -= damage;
        log.push(`　→ ${crit ? "会心の一撃! " : ""}${target.displayName} に ${damage} ダメージ!`);
        continue;
      }

      log.push(`⚔️ ${actor.displayName} のこうげき! ${pick(ATTACK_QUOTES)}`);
      const { damage, crit } = computeDamage(atkValue, target.def, 1.0, targetDefMult, actor.luck);
      target.hp -= damage;
      log.push(`　→ ${crit ? "会心の一撃! " : ""}${target.displayName} に ${damage} ダメージ!`);
    }

    if (a.invincibleRounds > 0) a.invincibleRounds -= 1;
    if (b.invincibleRounds > 0) b.invincibleRounds -= 1;
  }

  if (a.hp <= 0 && b.hp <= 0) {
    // 相打き: HP割合が同じなら速度で、それも同じならランダムで決める
    const winner = a.spd === b.spd ? (Math.random() < 0.5 ? a : b) : a.spd > b.spd ? a : b;
    log.push(`💥 相打ち…! わずかに${winner.displayName}が上回った。`);
    return { log, winnerId: winner.userId };
  }
  if (a.hp <= 0) return { log, winnerId: b.userId };
  if (b.hp <= 0) return { log, winnerId: a.userId };

  // 上限ラウンドに到達: 残りHP割合が高い方の勝ち
  const aPct = a.hp / a.maxHp;
  const bPct = b.hp / b.maxHp;
  const winner = aPct === bPct ? (Math.random() < 0.5 ? a : b) : aPct > bPct ? a : b;
  log.push(`⌛ 時間切れ…残りHPの多い ${winner.displayName} の判定勝ち!`);
  return { log, winnerId: winner.userId };
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function shuffleParticipants<T>(arr: T[]): T[] {
  return shuffle(arr);
}
