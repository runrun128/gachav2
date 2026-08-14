import {
  ATK_DEBUFF_MULT,
  ATK_DEBUFF_ROUNDS,
  BOSSES,
  BOSS_SELFHEAL_CHANCE,
  BOSS_SELFHEAL_PERCENT,
  BOSS_SHIELD_REDUCTION,
  BOSS_SHIELD_ROUNDS,
  BURN_DAMAGE_PERCENT,
  BURN_ROUNDS,
  BossKey,
  DEFEND_HEAL_PERCENT,
  GAMBLE_COOLDOWN_ROUNDS,
  GAMBLE_RECOIL_PERCENT,
  GAMBLE_SUCCESS_CHANCE,
  HEAL_SPECIAL_PERCENT_RAID,
  ITEMS,
  POISON_ROUNDS,
  SILENCE_ROUNDS,
  SPECIAL_ATTACK_MULTIPLIER,
  SPECIAL_COOLDOWN_ROUNDS,
  SPECIAL_SHIELD_ROUNDS,
  SPECIAL_TYPES,
  WEAKPOINT_MULTIPLIER,
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
import { RaidBoss, RaidFighter, RaidRoom, RaidRoundStep } from "./types";

function snapshot(room: RaidRoom, actorId: string): RaidRoundStep {
  const participantHp: Record<string, number> = {};
  for (const pid of room.participantIds) {
    const f = room.fighters[pid];
    if (f) participantHp[pid] = f.hp;
  }
  return { upToLine: room.log.length, participantHp, bossHp: room.boss!.hp, actorId };
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

export function buildBossFighter(bossKey: BossKey, participantCount: number): RaidBoss {
  const info = BOSSES[bossKey];
  const scaledHp = Math.round(info.hp * (1 + 0.6 * (participantCount - 1)));
  const scaledAtk = info.atk + 2 * (participantCount - 1);
  return {
    key: bossKey,
    name: `${info.emoji} ${info.name}`,
    maxHp: scaledHp,
    hp: scaledHp,
    atk: scaledAtk,
    def: info.def,
    spd: info.spd,
    enraged: false,
    roarUsed: false,
    healedOnce: false,
    shieldRounds: 0,
    shieldUsed: false,
    atkDebuffRounds: 0,
    poisonRounds: 0,
  };
}

export function buildRaidFighter(character: CharacterLike, userId: string, displayName: string): RaidFighter {
  const base = buildFighter(character, userId, displayName);
  return { ...base, burnRounds: 0, silencedRounds: 0, frozen: false };
}

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sampleN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  while (result.length < n && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

export function aliveParticipantIds(room: RaidRoom): string[] {
  return room.participantIds.filter((pid) => (room.fighters[pid]?.hp ?? 0) > 0);
}

export function actionableParticipantIds(room: RaidRoom): string[] {
  return aliveParticipantIds(room).filter((pid) => !room.frozenThisRound.has(pid));
}

/** ラウンド開始時の状態異常処理(凍結消費・火傷/毒ダメージ・弱体カウントダウン)。next_round()相当。 */
export function applyRoundStartEffects(room: RaidRoom) {
  room.frozenThisRound = new Set(room.participantIds.filter((pid) => room.fighters[pid]?.frozen));
  for (const pid of room.frozenThisRound) {
    room.fighters[pid]!.frozen = false;
  }

  for (const pid of room.participantIds) {
    const f = room.fighters[pid];
    if (!f) continue;
    if (f.burnRounds > 0 && f.hp > 0) {
      const dmg = Math.round(f.maxHp * BURN_DAMAGE_PERCENT);
      f.hp -= dmg;
      f.burnRounds -= 1;
      room.log.push(`🔥 ${f.displayName} は火傷で ${dmg} ダメージ!`);
    }
    if (f.poisonRounds > 0 && f.hp > 0) {
      const dmg = Math.round(f.maxHp * BURN_DAMAGE_PERCENT);
      f.hp -= dmg;
      f.poisonRounds -= 1;
      room.log.push(`🕷️ ${f.displayName} は毒で ${dmg} ダメージ!`);
    }
    if (f.atkDebuffRounds > 0) f.atkDebuffRounds -= 1;
    if (f.silencedRounds > 0) f.silencedRounds -= 1;
  }

  const boss = room.boss!;
  if (boss.shieldRounds > 0) boss.shieldRounds -= 1;
  if (boss.atkDebuffRounds > 0) boss.atkDebuffRounds -= 1;
  if (boss.poisonRounds > 0 && boss.hp > 0) {
    const dmg = Math.round(boss.maxHp * BURN_DAMAGE_PERCENT);
    boss.hp -= dmg;
    boss.poisonRounds -= 1;
    room.log.push(`🕷️ ${boss.name} は毒で ${dmg} ダメージ!`);
  }
}

function resolveGambleVsBoss(actor: RaidFighter, boss: RaidBoss): string[] {
  actor.gambleCooldown = GAMBLE_COOLDOWN_ROUNDS;

  if (Math.floor(Math.random() * 100) + 1 <= GAMBLE_SUCCESS_CHANCE) {
    boss.hp = 0;
    return [
      `💀 ${actor.displayName} の一か八かの一撃が決まった! ${GAMBLE_SUCCESS_QUOTE}`,
      `${boss.name} を一撃で沈めた!!`,
    ];
  }

  const { damage } = computeDamage(actor.atk, boss.def, 0.4, 1.0, actor.luck, false);
  boss.hp -= damage;
  const recoil = Math.round(actor.maxHp * GAMBLE_RECOIL_PERCENT);
  actor.hp = Math.max(0, actor.hp - recoil);

  return [
    `💀 ${actor.displayName} の一か八かの一撃…不発。${pick(GAMBLE_FAIL_QUOTES)} ` +
      `${boss.name} に ${damage} ダメージ、反動で自分も ${recoil} ダメージを受けた。`,
  ];
}

function resolveItemEffectVsBoss(itemKey: string, actor: RaidFighter, boss: RaidBoss): string[] {
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
      const { damage, crit } = computeDamage(actor.atk, boss.def, item.value, 1.0, actor.luck);
      boss.hp -= damage;
      return [`${label} — ${actor.displayName}!${crit ? " 会心の一撃!" : ""} ${boss.name} に ${damage} ダメージ!`];
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
      boss.atkDebuffRounds = Math.max(boss.atkDebuffRounds, Math.trunc(item.value) || ATK_DEBUFF_ROUNDS);
      return [`${label} — ${actor.displayName} が使った!${boss.name} の攻撃力が下がった。`];
    }
    case "poison": {
      boss.poisonRounds = Math.max(boss.poisonRounds, Math.trunc(item.value));
      return [`${label} — ${actor.displayName} が使った!${boss.name} は毒状態になった。`];
    }
    case "nuke_and_full_heal": {
      const { damage, crit } = computeDamage(actor.atk, boss.def, item.value, 1.0, actor.luck);
      boss.hp -= damage;
      actor.hp = actor.maxHp;
      return [
        `${label} — ${actor.displayName}!${crit ? " 会心の一撃!" : ""} ${boss.name} に ${damage} ダメージ!自分のHPも全回復した!`,
      ];
    }
    case "extra_turn": {
      const { damage, crit } = computeDamage(actor.atk, boss.def, 1.0, 1.0, actor.luck);
      boss.hp -= damage;
      return [
        `${label} — ${actor.displayName} が使った!時が歪み、もう一度行動する!`,
        `　→ 追加行動!${crit ? "会心の一撃! " : ""}${boss.name} に ${damage} ダメージ!`,
      ];
    }
    default:
      return [`${label} — ${actor.displayName} が使った。`];
  }
}

/** 参加者の行動を速度順に解決する。_resolve_round_inner の参加者パートに相当。 */
export function resolveParticipantActions(
  room: RaidRoom,
  weakPointActive: boolean
): { bossDefeated: boolean; steps: RaidRoundStep[] } {
  const boss = room.boss!;
  const acting = actionableParticipantIds(room);
  const steps: RaidRoundStep[] = [];

  for (const pid of acting) {
    if (!room.pending[pid]) room.pending[pid] = { type: "attack" };
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
  }

  room.log.push(`🎬 ラウンド${room.roundNo} 行動開始……`);

  for (const pid of order) {
    const f = room.fighters[pid]!;
    if (f.hp <= 0) continue;
    const action = room.pending[pid]!;
    const name = f.displayName;

    try {
      if (action.type === "defend") {
        const heal = Math.round(f.maxHp * DEFEND_HEAL_PERCENT);
        f.hp = Math.min(f.maxHp, f.hp + heal);
        room.log.push(`🛡️ ${name} は防御の構え。${pick(DEFEND_QUOTES)}`);
        room.log.push(`　→ HPが${heal}回復した。`);
        continue;
      }

      if (action.type === "item" && action.itemKey) {
        room.log.push(...resolveItemEffectVsBoss(action.itemKey, f, boss));
        continue;
      }

      if (action.type === "gamble") {
        room.log.push(`💀 ${name} が一か八かの一撃を放つ……!`);
        const bossHpBefore = boss.hp;
        const lines = resolveGambleVsBoss(f, boss);
        room.damageDealt[pid] = (room.damageDealt[pid] ?? 0) + Math.max(0, bossHpBefore - boss.hp);
        room.log.push(...lines);
        continue;
      }

      let atkValue = f.atk;
      if (f.atkDebuffRounds > 0) atkValue = Math.round(f.atk * ATK_DEBUFF_MULT);

      let multiplier: number;
      if (action.type === "special") {
        const stype = f.specialType ?? "attack";
        f.specialCooldown = SPECIAL_COOLDOWN_ROUNDS;
        room.log.push(
          `${SPECIAL_TYPES[stype].emoji} ${name} のとくぎ「${f.moveName}」(${SPECIAL_TYPES[stype].label})! ${pick(SPECIAL_QUOTES)}`
        );

        if (stype === "heal") {
          const lines: string[] = [];
          for (const allyId of room.participantIds) {
            const ally = room.fighters[allyId];
            if (!ally || ally.hp <= 0) continue;
            const heal = Math.round(ally.maxHp * HEAL_SPECIAL_PERCENT_RAID);
            ally.hp = Math.min(ally.maxHp, ally.hp + heal);
            lines.push(`　→ ${ally.displayName} のHPが${heal}回復した。`);
          }
          room.log.push("味方全員を回復した!");
          room.log.push(...lines);
          continue;
        }
        if (stype === "shield") {
          f.invincibleRounds = Math.max(f.invincibleRounds, SPECIAL_SHIELD_ROUNDS);
          room.log.push(`　→ ${SPECIAL_SHIELD_ROUNDS}ラウンドの間、被ダメージを無効化する盾を展開した!`);
          continue;
        }
        if (stype === "debuff") {
          boss.atkDebuffRounds = Math.max(boss.atkDebuffRounds, ATK_DEBUFF_ROUNDS);
          room.log.push(`　→ ${boss.name} の攻撃力を${ATK_DEBUFF_ROUNDS}ラウンドの間下げた!`);
          continue;
        }
        multiplier = SPECIAL_ATTACK_MULTIPLIER;
      } else {
        multiplier = 1.0;
        room.log.push(`⚔️ ${name} のこうげき! ${pick(ATTACK_QUOTES)}`);
      }

      let weakNote = "";
      if (weakPointActive) {
        multiplier *= WEAKPOINT_MULTIPLIER;
        weakNote = "🌟隙を突いた! ";
      }
      let shieldNote = "";
      if (boss.shieldRounds > 0) {
        multiplier *= BOSS_SHIELD_REDUCTION;
        shieldNote = "🌪️(盾で軽減) ";
      }

      const { damage, crit } = computeDamage(atkValue, boss.def, multiplier, 1.0, f.luck);
      boss.hp -= damage;
      room.damageDealt[pid] = (room.damageDealt[pid] ?? 0) + damage;
      room.log.push(`　→ ${weakNote}${shieldNote}${crit ? "会心の一撃! " : ""}${boss.name} に ${damage} ダメージ!`);
    } finally {
      steps.push(snapshot(room, pid));
    }

    if (boss.hp <= 0) break;
  }

  return { bossDefeated: boss.hp <= 0, steps };
}

/** ボスの行動。boss_turn() 相当。ボスの1ターン分をまとめて1ステップとして返す。 */
export function bossTurn(room: RaidRoom): RaidRoundStep[] {
  if (aliveParticipantIds(room).length === 0) return [];
  bossTurnInner(room);
  return [snapshot(room, "boss")];
}

function bossTurnInner(room: RaidRoom) {
  const boss = room.boss!;
  const info = BOSSES[room.bossKey];
  const aliveIds = aliveParticipantIds(room);
  if (aliveIds.length === 0) return;

  let bossAtkValue = boss.atk;
  if (boss.atkDebuffRounds > 0) bossAtkValue = Math.round(boss.atk * ATK_DEBUFF_MULT);

  if (!boss.healedOnce && boss.hp <= boss.maxHp * 0.5 && Math.floor(Math.random() * 100) + 1 <= BOSS_SELFHEAL_CHANCE) {
    boss.healedOnce = true;
    const heal = Math.round(boss.maxHp * BOSS_SELFHEAL_PERCENT);
    boss.hp = Math.min(boss.maxHp, boss.hp + heal);
    room.log.push(`💫 ${boss.name} が起死回生の力を発動! 「まだだ…終わらせはしない…!」`);
    room.log.push(`　→ HPが ${heal} 回復した!`);
    return;
  }

  if (room.bossKey === "varga" && !boss.roarUsed && !boss.enraged && boss.hp <= boss.maxHp * (info.roarThreshold ?? 0.6)) {
    boss.roarUsed = true;
    room.log.push(`🐉 ${boss.name} が「${info.roarMoveName}」を放った…! ${info.roarMoveQuote}`);
    for (const pid of aliveIds) room.fighters[pid]!.atkDebuffRounds = ATK_DEBUFF_ROUNDS;
    room.log.push(`　→ 参加者全員の攻撃力が${ATK_DEBUFF_ROUNDS}ラウンドの間低下した!`);
    return;
  }

  if (room.bossKey === "varga" && !boss.enraged && boss.hp <= boss.maxHp * (info.enrageThreshold ?? 0.3)) {
    boss.enraged = true;
    room.log.push(`🔥 ${boss.name} が怒りに目覚めた…! ${info.specialQuote}`);
  }

  const vargaEnraged = room.bossKey === "varga" && boss.enraged;
  const enrageMultiplier = vargaEnraged ? info.enrageMultiplier ?? 1.0 : 1.0;

  if (room.bossKey === "gehenna" && room.roundNo % 3 === 0) {
    room.log.push(`🔥 ${boss.name} が「${info.specialName}」の構え…… ${info.specialQuote}`);
    const aoeMultiplier = boss.hp <= boss.maxHp * 0.5 ? 1.3 : 1.0;
    for (const pid of aliveIds) {
      const target = room.fighters[pid]!;
      const defMult = defenseMultiplier(target, room.pending[pid]);
      const { damage, crit } = computeDamage(bossAtkValue, target.def, aoeMultiplier, defMult, 0);
      target.hp -= damage;
      room.log.push(`　→ ${target.displayName} に ${crit ? "会心! " : ""}${damage} ダメージ!`);
    }
    return;
  }

  if (room.bossKey === "gehenna" && Math.floor(Math.random() * 100) + 1 <= (info.burnMoveChance ?? 0)) {
    room.log.push(`🔥 ${boss.name} が「${info.burnMoveName}」を放つ…… ${info.burnMoveQuote}`);
    const targetId = pickOne(aliveIds);
    const target = room.fighters[targetId]!;
    const defMult = defenseMultiplier(target, room.pending[targetId]);
    const { damage, crit } = computeDamage(bossAtkValue, target.def, 1.1, defMult, 0);
    target.hp -= damage;
    target.burnRounds = BURN_ROUNDS;
    room.log.push(
      `　→ ${crit ? "会心の一撃! " : ""}${target.displayName} に ${damage} ダメージ!さらに${BURN_ROUNDS}ラウンドの間、火傷状態になった。`
    );
    return;
  }

  if (room.bossKey === "lilith" && room.roundNo % 3 === 0) {
    room.log.push(`🧊 ${boss.name} が「${info.specialName}」の構え…… ${info.specialQuote}`);
    const targetId = pickOne(aliveIds);
    const target = room.fighters[targetId]!;
    const defMult = defenseMultiplier(target, room.pending[targetId]);
    const { damage, crit } = computeDamage(bossAtkValue, target.def, 1.5, defMult, 0);
    target.hp -= damage;
    room.log.push(`　→ ${crit ? "会心の一撃! " : ""}${target.displayName} に ${damage} ダメージ!`);

    const others = aliveIds.filter((id) => id !== targetId);
    if (others.length) {
      const frozenId = pickOne(others);
      room.fighters[frozenId]!.frozen = true;
      room.log.push(`🧊 ${room.fighters[frozenId]!.displayName} も凍結した!次のラウンドは動けない。`);
    }
    return;
  }

  if (room.bossKey === "lilith" && aliveIds.length >= 2 && Math.floor(Math.random() * 100) + 1 <= (info.blizzardMoveChance ?? 0)) {
    room.log.push(`🧊 ${boss.name} が「${info.blizzardMoveName}」を放つ…… ${info.blizzardMoveQuote}`);
    const targets = sampleN(aliveIds, 2);
    for (const targetId of targets) {
      const target = room.fighters[targetId]!;
      const defMult = defenseMultiplier(target, room.pending[targetId]);
      const { damage, crit } = computeDamage(bossAtkValue, target.def, 0.8, defMult, 0);
      target.hp -= damage;
      room.log.push(`　→ ${target.displayName} に ${crit ? "会心! " : ""}${damage} ダメージ!`);
    }
    return;
  }

  if (room.bossKey === "voltex" && !boss.shieldUsed && boss.hp <= boss.maxHp * (info.shieldThreshold ?? 0.4)) {
    boss.shieldUsed = true;
    boss.shieldRounds = BOSS_SHIELD_ROUNDS;
    room.log.push(`🌪️ ${boss.name} が「${info.shieldMoveName}」を展開! ${info.shieldMoveQuote}`);
    room.log.push(`　→ ${BOSS_SHIELD_ROUNDS}ラウンドの間、受けるダメージが軽減される!`);
    return;
  }

  if (room.bossKey === "voltex" && room.roundNo % 3 === 0) {
    room.log.push(`🌪️ ${boss.name} が「${info.specialName}」の構え…… ${info.specialQuote}`);
    const targets = sampleN(aliveIds, Math.min(3, aliveIds.length));
    for (const targetId of targets) {
      const target = room.fighters[targetId]!;
      const defMult = defenseMultiplier(target, room.pending[targetId]);
      const { damage, crit } = computeDamage(bossAtkValue, target.def, 1.0, defMult, 0);
      target.hp -= damage;
      room.log.push(`　→ ${target.displayName} に ${crit ? "会心! " : ""}${damage} ダメージ!`);
    }
    return;
  }

  if (room.bossKey === "arachne" && room.roundNo % 3 === 0) {
    room.log.push(`🕷️ ${boss.name} が「${info.specialName}」の構え…… ${info.specialQuote}`);
    const targetId = pickOne(aliveIds);
    const target = room.fighters[targetId]!;
    target.silencedRounds = SILENCE_ROUNDS;
    room.log.push(`　→ ${target.displayName} の力が封じられた!${SILENCE_ROUNDS}ラウンドの間、とくぎ・一か八かが使えない。`);
    return;
  }

  if (room.bossKey === "shade" && room.roundNo % 3 === 0) {
    room.log.push(`🌑 ${boss.name} が「${info.specialName}」の構え…… ${info.specialQuote}`);
    const targetId = pickOne(aliveIds);
    const target = room.fighters[targetId]!;
    const defMult = defenseMultiplier(target, room.pending[targetId]);
    const { damage, crit } = computeDamage(bossAtkValue, target.def, 1.4, defMult, 0);
    target.hp -= damage;
    const drain = Math.round(damage * (info.drainRatio ?? 0.5));
    boss.hp = Math.min(boss.maxHp, boss.hp + drain);
    room.log.push(
      `　→ ${crit ? "会心の一撃! " : ""}${target.displayName} に ${damage} ダメージ!${boss.name} はそのうち ${drain} を吸い取り自らのHPに変えた。`
    );
    return;
  }

  const quote = pick(info.attackQuotes);
  room.log.push(`${boss.name} ${quote}`);
  const targetId = pickOne(aliveIds);
  const target = room.fighters[targetId]!;
  const defMult = defenseMultiplier(target, room.pending[targetId]);
  const { damage, crit } = computeDamage(bossAtkValue, target.def, enrageMultiplier, defMult, 0);
  target.hp -= damage;
  const moveText = vargaEnraged ? `専用技「${info.specialName}」` : "攻撃";
  room.log.push(`　→ ${boss.name} の${moveText}! ${crit ? "会心の一撃! " : ""}${target.displayName} に ${damage} ダメージ!`);

  if (room.bossKey === "lilith" && Math.floor(Math.random() * 100) + 1 <= (info.freezeChance ?? 0)) {
    const others = aliveIds.filter((id) => id !== targetId);
    if (others.length) {
      const frozenId = pickOne(others);
      room.fighters[frozenId]!.frozen = true;
      room.log.push(`🧊 ${room.fighters[frozenId]!.displayName} が凍結した!次のラウンドは動けない。`);
    }
  }

  if (room.bossKey === "arachne" && Math.floor(Math.random() * 100) + 1 <= (info.poisonChance ?? 0)) {
    target.poisonRounds = POISON_ROUNDS;
    room.log.push(`🕷️ ${target.displayName} は猛毒に侵された!${POISON_ROUNDS}ラウンドの間、毒状態になる。`);
  }

  if (room.bossKey === "shade" && Math.floor(Math.random() * 100) + 1 <= (info.curseMoveChance ?? 0)) {
    target.atkDebuffRounds = Math.max(target.atkDebuffRounds, ATK_DEBUFF_ROUNDS);
    room.log.push(`🌑 ${info.curseMoveQuote} ${target.displayName} の攻撃力が${ATK_DEBUFF_ROUNDS}ラウンドの間下がった!`);
  }
}
