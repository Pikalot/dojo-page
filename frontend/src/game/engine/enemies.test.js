import { describe, expect, it } from 'vitest';
import { applyStrike, createEnemy, throwEnemy } from './enemies.js';
import { createRandom } from './random.js';
import { createSession, pushInput, step } from './session.js';
import { STEP_MS, TUNING } from './tuning.js';

/** A session already fighting, with no automatic spawning, the player at (400, 400). */
function arena(enemies = []) {
  const session = createSession({ seed: 7, easyMode: false });
  session.phase = 'fighting';
  session.player.x = 400;
  session.player.y = 400;
  session.player.facing = 1;
  for (const options of enemies) {
    const enemy = createEnemy({ id: session.nextEnemyId++, kind: 'walker', x: 460, y: 400, now: 0, ...options });
    Object.assign(enemy, options);
    session.enemies.push(enemy);
  }
  return session;
}

function run(session, ms) {
  const events = [];
  const steps = Math.ceil(ms / STEP_MS - 1e-9);
  for (let i = 0; i < steps; i += 1) events.push(...step(session, STEP_MS));
  return events;
}

const types = (events) => events.map((e) => e.type);
const first = (session) => session.enemies[0];

describe('walking and winding up', () => {
  it('walkers approach the player', () => {
    const session = arena([{ x: 800 }]);
    run(session, 500);
    expect(first(session).x).toBeLessThan(800);
    expect(first(session).action).toBe('approaching');
  });

  it('a walker winds up at 80 units, not at 81, and warns', () => {
    const at80 = arena([{ x: 480 }]);
    expect(types(run(at80, STEP_MS))).toContain('warning');
    expect(first(at80).action).toBe('windingUp');

    const at81 = arena([{ x: 481 }]);
    run(at81, STEP_MS);
    expect(first(at81).action).toBe('approaching');
  });

  it('a walker winds up for 700 ms, then attacks for 10 damage', () => {
    const session = arena([{ x: 460 }]);
    run(session, STEP_MS);
    const started = session.time;
    expect(first(session).attackLandsAt).toBeCloseTo(started + 700, 0);
    const events = run(session, 700);
    expect(types(events)).toContain('playerHit');
    expect(session.player.health).toBe(90);
  });

  it('enemies line up with the player before winding up', () => {
    const session = arena([{ x: 460, y: 440 }]);
    run(session, STEP_MS);
    expect(first(session).action).toBe('approaching');
    run(session, 300);
    expect(Math.abs(first(session).y - 400)).toBeLessThanOrEqual(20);
    expect(first(session).action).toBe('windingUp');
  });

  it('never starts a wind-up before nextAttackNotBefore', () => {
    const session = arena([{ x: 460, nextAttackNotBefore: 1000 }]);
    run(session, 900);
    expect(first(session).action).toBe('approaching');
    run(session, 200);
    expect(first(session).action).toBe('windingUp');
    expect(first(session).attackLandsAt).toBeGreaterThanOrEqual(1700 - 1e-6);
  });
});

describe('dodging (FR-001a)', () => {
  it('an attack misses when the player has left the line, with no damage and no points', () => {
    const session = arena([{ x: 460 }]);
    run(session, STEP_MS);
    session.player.y = 430;
    const events = run(session, 700);
    expect(types(events)).toContain('dodged');
    expect(types(events)).not.toContain('playerHit');
    expect(session.player.health).toBe(100);
    expect(session.stats.dodges).toBe(1);
    expect(session.stats.score).toBe(0);
    expect(first(session).action).toBe('recovering');
  });
});

describe('dashers: the whirlwind kick', () => {
  const { kickSpeed } = TUNING.enemy;

  it('starts its crouch only between 250 and 450 units, with a special warning', () => {
    const near = arena([{ kind: 'dasher', x: 400 + 249 }]);
    run(near, STEP_MS);
    expect(first(near).action).toBe('approaching');

    const inside = arena([{ kind: 'dasher', x: 400 + 450 }]);
    const events = run(inside, STEP_MS);
    expect(types(events)).toContain('dashStarted');
    expect(events.find((e) => e.type === 'warning')).toMatchObject({ special: true });
    expect(first(inside).action).toBe('dashWindUp');

    const far = arena([{ kind: 'dasher', x: 400 + 451 }]);
    run(far, STEP_MS);
    expect(first(far).action).toBe('approaching');
  });

  it('crouches 500 ms, then spins toward the player at kick speed and lands beside them', () => {
    const session = arena([{ kind: 'dasher', x: 700 }]);
    run(session, STEP_MS);
    const crouchedAt = session.time;
    run(session, 500);
    const enemy = first(session);
    expect(enemy.action).toBe('spinning');
    const travel = 700 - (400 + TUNING.distance.standOff);
    expect(enemy.attackLandsAt).toBeCloseTo(crouchedAt + 500 + (travel / kickSpeed) * 1000, 0);
    expect(kickSpeed).toBeLessThan(700); // slower than the old dash, so there is time to react
  });

  it('hits on landing for 3 × damage (30)', () => {
    const session = arena([{ kind: 'dasher', x: 700 }]);
    // Long enough for the kick to land, not for the punch that may follow it.
    const events = run(session, 1500);
    expect(events.find((e) => e.type === 'playerHit')).toMatchObject({ amount: 30, special: true });
    expect(session.player.health).toBe(70);
  });

  it('keeps its line: a player who steps off it makes it miss and skid 150 units, then recover for 600 ms', () => {
    const session = arena([{ kind: 'dasher', x: 700 }]);
    run(session, 600);
    expect(first(session).action).toBe('spinning');
    const line = first(session).lineY;
    session.player.y = 440;
    const events = run(session, 1400);
    expect(types(events)).toContain('dodged');
    expect(types(events)).toContain('overshoot');
    expect(first(session).y).toBe(line);
    expect(session.player.health).toBe(100);
    expect(first(session).x).toBeCloseTo(400 + TUNING.distance.standOff - 150, -1);
    run(session, 450);
    expect(first(session).action).toBe('approaching');
  });

  it('can be parried in the window before landing; the next attack is normal again', () => {
    const session = arena([{ kind: 'dasher', x: 700 }]);
    run(session, 600);
    pushInput(session, { type: 'parry', at: first(session).attackLandsAt - 100 });
    run(session, 1500);
    expect(session.player.health).toBe(100);
    expect(session.stats.throws).toBe(1);
  });

  it('a dasher that attacks without dashing punches for 10', () => {
    const session = arena([{ kind: 'dasher', x: 460 }]);
    const events = run(session, 600);
    expect(events.find((e) => e.type === 'playerHit')).toMatchObject({ amount: 10, special: false });
  });
});

describe('strikes', () => {
  it('on an approaching enemy: 1 damage, pushed back for 300 ms, combo armed, attack delayed 1 to 2.5 s', () => {
    const session = arena([{ x: 460, action: 'approaching' }]);
    const result = applyStrike(session, first(session), 0);
    const enemy = first(session);
    expect(result.delayed).toBe(true);
    expect(enemy).toMatchObject({ health: 3, action: 'pushedBack', comboArmed: true, delayUsed: true });
    expect(enemy.nextAttackNotBefore).toBeGreaterThanOrEqual(1000);
    expect(enemy.nextAttackNotBefore).toBeLessThanOrEqual(2500);
    run(session, 300 + STEP_MS);
    expect(first(session).action).toBe('approaching');
  });

  it('a second strike before the enemy attacks does not delay it again', () => {
    const session = arena([{ x: 460, action: 'approaching' }]);
    applyStrike(session, first(session), 0);
    const delay = first(session).nextAttackNotBefore;
    first(session).action = 'approaching';
    const result = applyStrike(session, first(session), 1500);
    expect(result.delayed).toBe(false);
    expect(first(session).nextAttackNotBefore).toBe(delay);
  });

  it('cancels a wind-up only when the attack has not been delayed yet', () => {
    const fresh = arena([{ x: 460 }]);
    run(fresh, STEP_MS);
    applyStrike(fresh, first(fresh), fresh.time);
    expect(first(fresh).action).toBe('pushedBack');
    expect(first(fresh).attackLandsAt).toBe(null);

    const delayed = arena([{ x: 460, delayUsed: true }]);
    run(delayed, STEP_MS);
    const landsAt = first(delayed).attackLandsAt;
    const x = first(delayed).x;
    applyStrike(delayed, first(delayed), delayed.time);
    expect(first(delayed).action).toBe('windingUp');
    expect(first(delayed).attackLandsAt).toBe(landsAt);
    expect(first(delayed).x).toBe(x + 60);
  });

  it('four strikes defeat an enemy, for fewer points than a throw', () => {
    const session = arena([{ x: 460, action: 'approaching' }]);
    const events = [];
    for (let i = 0; i < 4; i += 1) {
      first(session).action = 'approaching';
      events.push(...applyStrike(session, first(session), i * 1500).events);
    }
    expect(first(session).action).toBe('defeated');
    expect(events.at(-1)).toMatchObject({ type: 'enemyDefeated', by: 'strikes' });
    expect(session.stats.enemiesDefeated).toBe(1);
    expect(session.stats.score).toBe(TUNING.score.strikeDefeat);
    expect(session.stats.score).toBeLessThan(TUNING.score.throw);
  });

  it('do not affect enemies that are spinning, attacking, recovering or thrown', () => {
    for (const action of ['spinning', 'attacking', 'recovering', 'thrown']) {
      const session = arena([{ x: 460, action }]);
      const result = applyStrike(session, first(session), 0);
      expect(result.affected, action).toBe(false);
      expect(first(session).health, action).toBe(4);
    }
  });

  it('striking one enemy every 1500 ms for 20 s still lets it attack', () => {
    const session = arena([{ x: 460, health: 1000 }]);
    for (let at = 0; at < 20000; at += 1500) pushInput(session, { type: 'strike', at });
    const events = run(session, 20000);
    expect(types(events)).toContain('playerHit');
  });

  it('delayUsed and comboArmed clear when the attack resolves', () => {
    const session = arena([{ x: 460, delayUsed: true, comboArmed: true }]);
    run(session, 800);
    expect(first(session)).toMatchObject({ delayUsed: false, comboArmed: false });
  });
});

describe('throws and knock-downs', () => {
  it('a normal throw lands right beside the player on the far side; then the enemy is defeated and removed', () => {
    const session = arena([{ x: 460 }]);
    throwEnemy(session, first(session), { perfect: false });
    const events = run(session, TUNING.enemy.thrownFlightMs + STEP_MS);
    expect(first(session).action).toBe('defeated');
    expect(first(session).x).toBe(400 - TUNING.distance.throwBeside);
    expect(events.find((e) => e.type === 'enemyDefeated')).toMatchObject({ by: 'throw' });
    run(session, 400 + STEP_MS);
    expect(session.enemies).toHaveLength(0);
  });

  it('a thrown enemy comes down on the floor at the height of the player\'s feet', () => {
    const session = arena([{ x: 460, y: 415 }]);
    throwEnemy(session, first(session), { perfect: false });
    run(session, TUNING.enemy.thrownFlightMs + STEP_MS);
    expect(first(session).action).toBe('defeated');
    expect(first(session).y).toBe(session.player.y);
  });

  it('a critical throw lands 70 to 140 units from the player on the far side (3 to 6 feet)', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const session = arena([{ x: 460 }]);
      session.rng = createRandom(seed);
      throwEnemy(session, first(session), { perfect: true });
      run(session, TUNING.enemy.thrownFlightMs + STEP_MS);
      const distance = 400 - first(session).x;
      expect(distance).toBeGreaterThanOrEqual(70);
      expect(distance).toBeLessThanOrEqual(140);
    }
  });

  it('an enemy right behind the player is defeated by a normal throw, so one throw defeats two', () => {
    const session = arena([{ x: 460 }, { x: 400 - 50, y: 405 }]);
    throwEnemy(session, first(session), { perfect: false });
    run(session, TUNING.enemy.thrownFlightMs + STEP_MS);
    expect(session.enemies.every((e) => e.action === 'defeated')).toBe(true);
    expect(session.stats.enemiesDefeated).toBe(2);
  });

  it('a thrown enemy defeats any other enemy on its path, for the same points as a throw', () => {
    // The off-line enemy starts far enough away that it is still off the line when the throw passes.
    // Throws go over to the far side, so the others stand on that side, near the landing spot.
    const session = arena([{ x: 460 }, { x: 360, y: 410 }, { x: 360, y: 480 }]);
    const [thrown, onLine, offLine] = session.enemies;
    throwEnemy(session, thrown, { perfect: false });
    const events = run(session, 600);
    expect(onLine.action).toBe('defeated');
    expect(offLine.action).not.toBe('defeated');
    expect(events.filter((e) => e.type === 'enemyDefeated' && e.by === 'thrownInto')).toEqual([
      expect.objectContaining({ enemyId: onLine.id, by: 'thrownInto' }),
    ]);
    expect(session.stats.score).toBe(TUNING.score.chainDefeat);
    expect(TUNING.score.chainDefeat).toBe(TUNING.score.throw);
    // Both the thrown attacker and the one it hit count as defeated.
    expect(session.stats.enemiesDefeated).toBe(2);
  });

  it('the player cannot be hit while throwing', () => {
    const session = arena([{ x: 460 }]);
    run(session, STEP_MS);
    session.player.action = 'throwing';
    session.player.actionEndsAt = session.time + 2000;
    run(session, 800);
    expect(session.player.health).toBe(100);
  });
});
