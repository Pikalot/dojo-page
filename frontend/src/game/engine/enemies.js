import { TUNING } from './tuning.js';

/**
 * Enemy state machine (data-model.md "Enemy"). Actions:
 * approaching → windingUp (punch) → attacking → recovering → approaching
 * approaching → dashWindUp (crouch) → spinning (whirlwind kick) → lands: attacking | overshoot → recovering
 * pushedBack (struck), thrown → defeated → removed.
 */

const { enemy: E, distance: D, strike: S, player: P, score: SCORE, floor } = TUNING;

// Step ends are sums of floating-point step lengths; compare times with a little slack.
export const EPS = 1e-6;

export function createEnemy({ id, kind, x, y, now = 0 }) {
  return {
    id,
    kind,
    x,
    y,
    health: E.health,
    action: 'approaching',
    actionStartedAt: now,
    actionEndsAt: 0,
    attackLandsAt: null,
    lastLandedAt: null,
    lastDodgedAt: null,
    lineY: null,
    dashDir: 0,
    // Whirlwind kick: where it lands, and where it skids to after a miss.
    kickTo: null,
    overshootTo: null,
    nextAttackNotBefore: 0,
    delayUsed: false,
    comboArmed: false,
    // True for the whirlwind kick (a special move, 3 × damage).
    special: false,
    // True after a whirlwind kick has landed, until the next attack (for the landing pose).
    kickLanded: false,
    // Flight after a throw or strike.
    fromX: x,
    toX: x,
    critical: false,
    knocked: [],
  };
}

function emit(session, event) {
  session.events.push(event);
  return event;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function moveToward(value, target, maxStep) {
  if (Math.abs(target - value) <= maxStep) return target;
  return value + Math.sign(target - value) * maxStep;
}

function setAction(enemy, action, startedAt, durationMs = 0) {
  enemy.action = action;
  enemy.actionStartedAt = startedAt;
  enemy.actionEndsAt = startedAt + durationMs;
}

function startWindUp(session, enemy, at, { special = false } = {}) {
  enemy.kickLanded = false;
  setAction(enemy, 'windingUp', at, E.windUpMs[enemy.kind]);
  enemy.attackLandsAt = at + E.windUpMs[enemy.kind];
  enemy.special = special;
  emit(session, { type: 'warning', at, enemyId: enemy.id, special });
}

function cancelAttack(enemy) {
  enemy.attackLandsAt = null;
  enemy.special = false;
}

/** Where an enemy stops: beside the player, on its own side. */
function standOffX(enemy, player) {
  const side = Math.sign(enemy.x - player.x) || 1;
  return player.x + side * D.standOff;
}

/** The attack lands now. Returns 'dodged', 'missed', 'blocked' or 'hit'. */
function resolveAttack(session, enemy) {
  const { player } = session;
  const at = enemy.attackLandsAt;
  const { special } = enemy;
  enemy.lastLandedAt = at;
  cancelAttack(enemy);
  enemy.delayUsed = false;
  enemy.comboArmed = false;

  const dodged = Math.abs(player.y - enemy.y) > D.lineTolerance;
  const outOfReach = Math.abs(player.x - enemy.x) > D.reach;
  const protectedByThrow = player.action === 'throwing' && player.actionEndsAt > at;

  if (dodged) {
    enemy.lastDodgedAt = at;
    session.stats.dodges += 1;
    session.stats.score += SCORE.dodge;
    emit(session, { type: 'dodged', at, enemyId: enemy.id });
    setAction(enemy, 'recovering', at, E.recoverMs);
    return 'dodged';
  }
  if (outOfReach || protectedByThrow) {
    setAction(enemy, 'recovering', at, E.recoverMs);
    return 'missed';
  }
  if (player.guard) {
    // Hold to block (FR-006a): no damage, no throw, no points; the attacker bounces off.
    player.guard.blocked = true;
    emit(session, { type: 'blocked', at, enemyId: enemy.id, special });
    setAction(enemy, 'recovering', at, E.recoverMs);
    return 'blocked';
  }
  const amount = E.damage * (special ? E.specialMultiplier : 1);
  player.health = Math.max(0, player.health - amount);
  player.action = 'hit';
  player.actionEndsAt = at + P.hitMs;
  emit(session, { type: 'playerHit', at, enemyId: enemy.id, amount, special });
  setAction(enemy, 'attacking', at, E.attackMs);
  return 'hit';
}

/** Anyone the thrown attacker touches on its way is defeated too (FR-008). */
function defeatOthersOnPath(session, thrown, at) {
  for (const other of session.enemies) {
    if (other === thrown || thrown.knocked.includes(other.id)) continue;
    if (['thrown', 'defeated'].includes(other.action)) continue;
    if (Math.abs(other.x - thrown.x) > D.chainRadius) continue;
    if (Math.abs(other.y - thrown.y) > D.lineTolerance) continue;
    thrown.knocked.push(other.id);
    session.stats.score += SCORE.chainDefeat;
    defeat(session, other, at, 'thrownInto');
  }
}

function defeat(session, enemy, at, by) {
  cancelAttack(enemy);
  setAction(enemy, 'defeated', at, E.smokeMs);
  session.stats.enemiesDefeated += 1;
  return emit(session, { type: 'enemyDefeated', at, enemyId: enemy.id, by });
}

function updateEnemy(session, enemy, end, dtMs) {
  const { player } = session;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const lined = Math.abs(dy) <= D.lineTolerance;
  const canAttack = end >= enemy.nextAttackNotBefore - EPS;
  const walk = (E.walkSpeed * dtMs) / 1000;
  const kick = (E.kickSpeed * dtMs) / 1000;
  const done = end >= enemy.actionEndsAt - EPS;

  switch (enemy.action) {
    case 'approaching': {
      const distance = Math.abs(dx);
      if (lined && canAttack) {
        if (enemy.kind === 'dasher' && distance >= D.dashMin && distance <= D.dashMax) {
          // Whirlwind kick: crouch with the warning first (FR-002, FR-003).
          setAction(enemy, 'dashWindUp', end, E.dashWindUpMs);
          enemy.special = true;
          emit(session, { type: 'dashStarted', at: end, enemyId: enemy.id });
          emit(session, { type: 'warning', at: end, enemyId: enemy.id, special: true });
          return;
        }
        if (distance <= D.attackRange) {
          startWindUp(session, enemy, end);
          return;
        }
      }
      enemy.x = moveToward(enemy.x, standOffX(enemy, player), walk);
      enemy.y = moveToward(enemy.y, player.y, walk);
      return;
    }
    case 'windingUp': {
      if (end >= enemy.attackLandsAt - EPS) {
        resolveAttack(session, enemy);
        return;
      }
      // Close in during the wind-up (only across: moving off the line still dodges).
      enemy.x = moveToward(enemy.x, standOffX(enemy, player), walk);
      return;
    }
    case 'attacking':
      if (done) setAction(enemy, 'recovering', enemy.actionEndsAt, E.recoverMs);
      return;
    case 'recovering':
      if (done) setAction(enemy, 'approaching', enemy.actionEndsAt);
      return;
    case 'pushedBack': {
      const progress = Math.min(1, (end - enemy.actionStartedAt) / S.pushedBackMs);
      enemy.x = enemy.fromX + (enemy.toX - enemy.fromX) * progress;
      if (done) setAction(enemy, 'approaching', enemy.actionEndsAt);
      return;
    }
    case 'dashWindUp':
      if (done) {
        // Leap into the spin: it keeps this line and flies to a spot beside where the player
        // stands now. The hit comes when it lands there.
        const at = enemy.actionEndsAt;
        enemy.lineY = enemy.y;
        enemy.dashDir = Math.sign(dx) || 1;
        enemy.fromX = enemy.x;
        enemy.kickTo = player.x - enemy.dashDir * D.standOff;
        enemy.attackLandsAt = at + (Math.abs(enemy.kickTo - enemy.x) / E.kickSpeed) * 1000;
        setAction(enemy, 'spinning', at);
      }
      return;
    case 'spinning': {
      enemy.y = enemy.lineY;
      const flight = enemy.attackLandsAt - enemy.actionStartedAt;
      const progress = flight > 0 ? Math.min(1, (end - enemy.actionStartedAt) / flight) : 1;
      enemy.x = enemy.fromX + (enemy.kickTo - enemy.fromX) * progress;
      if (end >= enemy.attackLandsAt - EPS) {
        enemy.x = enemy.kickTo;
        enemy.kickLanded = true;
        const landedAt = enemy.attackLandsAt;
        if (resolveAttack(session, enemy) === 'dodged') {
          // The player left its line: it skids on past (FR-001b).
          enemy.overshootTo = clamp(enemy.x + enemy.dashDir * D.overshoot, floor.left, floor.right);
          setAction(enemy, 'overshoot', landedAt);
          emit(session, { type: 'overshoot', at: landedAt, enemyId: enemy.id });
        }
      }
      return;
    }
    case 'overshoot':
      enemy.x = moveToward(enemy.x, enemy.overshootTo, kick);
      if (enemy.x === enemy.overshootTo) setAction(enemy, 'recovering', end, E.overshootRecoverMs);
      return;
    case 'thrown': {
      const progress = Math.min(1, (end - enemy.actionStartedAt) / E.thrownFlightMs);
      enemy.x = enemy.fromX + (enemy.toX - enemy.fromX) * progress;
      defeatOthersOnPath(session, enemy, end);
      if (done) {
        enemy.x = enemy.toX;
        defeat(session, enemy, enemy.actionEndsAt, 'throw');
      }
      return;
    }
    default:
  }
}

/** Updates every enemy for the step ending at `end`, and removes those whose smoke has cleared. */
export function updateEnemies(session, end, dtMs) {
  for (const enemy of session.enemies) {
    if (enemy.action !== 'defeated') updateEnemy(session, enemy, end, dtMs);
  }
  session.enemies = session.enemies.filter(
    (enemy) => !(enemy.action === 'defeated' && end >= enemy.actionEndsAt - EPS),
  );
}

/** A successful parry: the enemy is thrown and will be defeated when it lands. */
export function throwEnemy(session, enemy, { perfect, at = session.time }) {
  // Led over the player to the far side: right beside them, or 3 to 6 feet away when perfect.
  const { player } = session;
  const side = Math.sign(enemy.x - player.x) || player.facing || 1;
  const distance = perfect ? session.rng.int(D.throwCriticalMin, D.throwCriticalMax) : D.throwBeside;
  enemy.fromX = enemy.x;
  enemy.toX = clamp(player.x - side * distance, floor.left, floor.right);
  enemy.lineY = enemy.y;
  enemy.critical = Boolean(perfect);
  cancelAttack(enemy);
  enemy.delayUsed = false;
  enemy.comboArmed = false;
  enemy.knocked = [];
  setAction(enemy, 'thrown', at, E.thrownFlightMs);
}

const STRIKABLE = new Set(['approaching', 'windingUp']);

/**
 * A strike that reached `enemy` at time `at` (FR-007, FR-008). Returns what it did and the
 * events it added to the session.
 */
export function applyStrike(session, enemy, at) {
  if (!STRIKABLE.has(enemy.action)) return { affected: false, delayed: false, events: [] };
  const before = session.events.length;
  enemy.health -= S.damage;
  enemy.comboArmed = true;
  const delayed = !enemy.delayUsed;

  emit(session, { type: 'struck', at, enemyId: enemy.id, delayed: delayed && enemy.health > 0 });
  if (enemy.health <= 0) {
    session.stats.score += SCORE.strikeDefeat;
    defeat(session, enemy, at, 'strikes');
    return { affected: true, delayed: false, defeated: true, events: session.events.slice(before) };
  }

  const dir = Math.sign(enemy.x - session.player.x) || 1;
  if (delayed) {
    enemy.nextAttackNotBefore = at + session.rng.int(S.delayMinMs, S.delayMaxMs);
    enemy.delayUsed = true;
  }
  if (enemy.action === 'approaching' || delayed) {
    cancelAttack(enemy);
    enemy.fromX = enemy.x;
    enemy.toX = enemy.x + dir * S.pushBack;
    setAction(enemy, 'pushedBack', at, S.pushedBackMs);
  } else {
    // Already delayed once: pushed back, but the wind-up keeps going.
    enemy.x += dir * S.pushBack;
  }
  return { affected: true, delayed, defeated: false, events: session.events.slice(before) };
}
