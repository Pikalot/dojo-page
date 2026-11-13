import { TUNING } from './tuning.js';

/**
 * Parry and strike judgment (data-model.md "Parry judgment" and "Strike judgment").
 * Pure functions of the press time and the current player and enemies: they return what
 * happened and the new cooldown values, and change nothing themselves.
 */

const { parry: PARRY, strike: STRIKE, distance: D } = TUNING;

// Enemies whose attack is on its way: a punch wind-up, or a whirlwind kick in the air.
const ATTACKING = new Set(['windingUp', 'spinning']);

export function parryWindow(easyMode) {
  return easyMode ? PARRY.easyWindowMs : PARRY.windowMs;
}

/**
 * Within reach across (90) and on the same line (20 up or down). A whirlwind kick is judged
 * where it will land, since it is still flying in during the parry window.
 */
export function inReach(player, enemy) {
  const x = enemy.action === 'spinning' && enemy.kickTo != null ? enemy.kickTo : enemy.x;
  return Math.abs(x - player.x) <= D.reach && Math.abs(enemy.y - player.y) <= D.lineTolerance;
}

/**
 * @returns {{ result: 'ignored' } | { result: 'success', enemyId, perfect, combo, parryReadyAt }
 *   | { result: 'guard', parryReadyAt } | { result: 'miss', missKind: 'late', parryReadyAt, stumbleUntil }}
 *
 * A press that is neither a parry nor late starts a guard (hold to block, FR-006a); whether it
 * ends in a block or a stumble depends on when the key is let go.
 */
export function judgeParry({ at, player, enemies, easyMode }) {
  const W = parryWindow(easyMode);
  if (at < player.parryReadyAt || at < player.stumbleUntil || player.action === 'throwing') {
    return { result: 'ignored' };
  }
  const parryReadyAt = at + W;

  const candidates = enemies
    .filter(
      (enemy) =>
        ATTACKING.has(enemy.action) &&
        enemy.attackLandsAt != null &&
        at >= enemy.attackLandsAt - W &&
        at <= enemy.attackLandsAt &&
        inReach(player, enemy),
    )
    .sort(
      (a, b) =>
        a.attackLandsAt - b.attackLandsAt || Math.abs(a.x - player.x) - Math.abs(b.x - player.x),
    );

  const target = candidates[0];
  if (target) {
    const t = target.attackLandsAt;
    const inPerfectZone = at >= t - PARRY.perfectFrom * W && at <= t - PARRY.perfectTo * W;
    const combo = Boolean(target.comboArmed);
    return { result: 'success', enemyId: target.id, perfect: inPerfectZone || combo, combo, parryReadyAt };
  }

  // "Too late" when an attack within reach landed (or was due) within one window before the press.
  const late = enemies.some((enemy) => {
    const landed = ATTACKING.has(enemy.action) ? enemy.attackLandsAt : enemy.lastLandedAt;
    return landed != null && at > landed && at - landed <= W && inReach(player, enemy);
  });
  if (!late) return { result: 'guard', parryReadyAt };
  return { result: 'miss', missKind: 'late', parryReadyAt, stumbleUntil: at + PARRY.stumbleMs };
}

const STRIKABLE = new Set(['approaching', 'windingUp']);

/** @returns {{ result: 'ignored' } | { result: 'struck', enemyId: number|null, strikeReadyAt }} */
export function judgeStrike({ at, player, enemies }) {
  if (at < player.strikeReadyAt || player.action === 'throwing') return { result: 'ignored' };
  const target = enemies
    .filter((enemy) => STRIKABLE.has(enemy.action) && inReach(player, enemy))
    .sort((a, b) => Math.abs(a.x - player.x) - Math.abs(b.x - player.x))[0];
  return { result: 'struck', enemyId: target ? target.id : null, strikeReadyAt: at + STRIKE.cooldownMs };
}
