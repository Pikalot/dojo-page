import { describe, expect, it } from 'vitest';
import { judgeParry, judgeStrike } from './parry.js';

const T = 10000; // the moment the attack lands
const W = 250;

function makePlayer(over = {}) {
  return { x: 400, y: 400, parryReadyAt: 0, stumbleUntil: 0, strikeReadyAt: 0, action: 'idle', ...over };
}

function makeEnemy(over = {}) {
  return {
    id: 1,
    x: 460,
    y: 400,
    health: 4,
    action: 'windingUp',
    attackLandsAt: T,
    comboArmed: false,
    lastLandedAt: null,
    ...over,
  };
}

function parry(at, { player = makePlayer(), enemies = [makeEnemy()], easyMode = false } = {}) {
  return judgeParry({ at, player, enemies, easyMode });
}

describe('judgeParry: window edges', () => {
  it('succeeds at the moment the attack lands and at the start of the window', () => {
    expect(parry(T).result).toBe('success');
    expect(parry(T - W).result).toBe('success');
  });

  it('turns an early press into a guard, with no stumble yet (FR-006a)', () => {
    const early = parry(T - W - 1);
    expect(early).toMatchObject({ result: 'guard', parryReadyAt: T - W - 1 + W });
    expect(early.stumbleUntil).toBeUndefined();
  });

  it('still stumbles at once on a late press', () => {
    const late = parry(T + 1, { enemies: [makeEnemy({ action: 'attacking', lastLandedAt: T })] });
    expect(late).toMatchObject({ result: 'miss', missKind: 'late', stumbleUntil: T + 1 + 500 });
  });

  it('turns a press with no attack anywhere near into a guard', () => {
    expect(parry(T, { enemies: [] })).toMatchObject({ result: 'guard' });
  });

  it('doubles the window in easy mode', () => {
    expect(parry(T - 500, { easyMode: true }).result).toBe('success');
    expect(parry(T - 501, { easyMode: true }).result).toBe('guard');
  });

  it('parries a whirlwind kick in the window before it lands', () => {
    const spinning = makeEnemy({ action: 'spinning', attackLandsAt: T });
    expect(parry(T - 100, { enemies: [spinning] }).result).toBe('success');
    expect(parry(T - 300, { enemies: [spinning] }).result).toBe('guard');
  });
});

describe('judgeParry: perfect zone', () => {
  it('is perfect in the middle half of the window', () => {
    expect(parry(T - 187.5)).toMatchObject({ result: 'success', perfect: true, combo: false });
    expect(parry(T - 62.5)).toMatchObject({ result: 'success', perfect: true });
  });

  it('is a normal success just outside the middle half', () => {
    expect(parry(T - 190)).toMatchObject({ result: 'success', perfect: false });
    expect(parry(T - 60)).toMatchObject({ result: 'success', perfect: false });
  });

  it('uses the middle half of the longer window in easy mode', () => {
    expect(parry(T - 375, { easyMode: true }).perfect).toBe(true);
    expect(parry(T - 125, { easyMode: true }).perfect).toBe(true);
    expect(parry(T - 380, { easyMode: true }).perfect).toBe(false);
  });
});

describe('judgeParry: cooldown and stumble', () => {
  it('sets parryReadyAt to press + window after every press, hit or miss', () => {
    expect(parry(T - 100).parryReadyAt).toBe(T - 100 + W);
    expect(parry(T - 900).parryReadyAt).toBe(T - 900 + W);
    expect(parry(T - 100, { easyMode: true }).parryReadyAt).toBe(T - 100 + 500);
  });

  it('ignores a press during the cooldown without restarting it', () => {
    const result = parry(T - 100, { player: makePlayer({ parryReadyAt: T - 50 }) });
    expect(result.result).toBe('ignored');
    expect(result.parryReadyAt).toBeUndefined();
  });

  it('ignores a press while stumbling', () => {
    expect(parry(T - 100, { player: makePlayer({ stumbleUntil: T }) }).result).toBe('ignored');
  });

  it('ignores a press while throwing', () => {
    expect(parry(T - 100, { player: makePlayer({ action: 'throwing' }) }).result).toBe('ignored');
  });
});

describe('judgeParry: combo', () => {
  it('is perfect anywhere in the window when the enemy was struck first', () => {
    const result = parry(T - 5, { enemies: [makeEnemy({ comboArmed: true })] });
    expect(result).toMatchObject({ result: 'success', perfect: true, combo: true });
  });
});

describe('judgeParry: which enemy', () => {
  it('throws only the enemy whose attack lands soonest', () => {
    const enemies = [makeEnemy({ id: 1, attackLandsAt: T + 50 }), makeEnemy({ id: 2, attackLandsAt: T })];
    expect(parry(T - 100, { enemies }).enemyId).toBe(2);
  });

  it('throws the nearest when two attacks land together', () => {
    const enemies = [makeEnemy({ id: 1, x: 480 }), makeEnemy({ id: 2, x: 350 })];
    expect(parry(T - 100, { enemies }).enemyId).toBe(2);
  });

  it('reaches 90 units across but not 91', () => {
    expect(parry(T, { enemies: [makeEnemy({ x: 490 })] }).result).toBe('success');
    expect(parry(T, { enemies: [makeEnemy({ x: 491 })] }).result).toBe('guard');
  });

  it('reaches 20 units up or down but not 21 (FR-001a)', () => {
    expect(parry(T, { enemies: [makeEnemy({ y: 420 })] }).result).toBe('success');
    expect(parry(T, { enemies: [makeEnemy({ y: 380 })] }).result).toBe('success');
    expect(parry(T, { enemies: [makeEnemy({ y: 421 })] }).result).toBe('guard');
    expect(parry(T, { enemies: [makeEnemy({ y: 379 })] }).result).toBe('guard');
  });

  it('succeeds whatever health the enemy has left', () => {
    expect(parry(T, { enemies: [makeEnemy({ health: 4 })] }).result).toBe('success');
    expect(parry(T, { enemies: [makeEnemy({ health: 1 })] }).result).toBe('success');
  });
});

describe('judgeStrike', () => {
  function strike(at, { player = makePlayer(), enemies = [makeEnemy({ action: 'approaching' })] } = {}) {
    return judgeStrike({ at, player, enemies });
  }

  it('starts a 1500 ms cooldown', () => {
    expect(strike(1000)).toMatchObject({ result: 'struck', enemyId: 1, strikeReadyAt: 2500 });
  });

  it('ignores a second strike inside the cooldown', () => {
    expect(strike(2000, { player: makePlayer({ strikeReadyAt: 2500 }) }).result).toBe('ignored');
  });

  it('leaves the parry available during the strike cooldown', () => {
    const player = makePlayer({ strikeReadyAt: T + 1500 });
    expect(parry(T, { player }).result).toBe('success');
  });

  it('still plays and cools down when nobody is in reach', () => {
    expect(strike(1000, { enemies: [] })).toMatchObject({ result: 'struck', enemyId: null, strikeReadyAt: 2500 });
  });

  it('reaches only 90 across and 20 up or down', () => {
    expect(strike(0, { enemies: [makeEnemy({ action: 'approaching', x: 491 })] }).enemyId).toBe(null);
    expect(strike(0, { enemies: [makeEnemy({ action: 'approaching', y: 421 })] }).enemyId).toBe(null);
    expect(strike(0, { enemies: [makeEnemy({ action: 'approaching', y: 420 })] }).enemyId).toBe(1);
  });

  it('only affects approaching or winding-up enemies, picking the nearest', () => {
    const enemies = [
      makeEnemy({ id: 1, x: 420, action: 'dashing' }),
      makeEnemy({ id: 2, x: 470, action: 'windingUp' }),
      makeEnemy({ id: 3, x: 460, action: 'approaching' }),
    ];
    expect(strike(0, { enemies }).enemyId).toBe(3);
  });
});
