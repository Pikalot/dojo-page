import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSession, pushInput, result, start, step } from './session.js';
import { STEP_MS, TUNING } from './tuning.js';

const { floor } = TUNING;

function run(session, ms) {
  const events = [];
  const steps = Math.round(ms / STEP_MS);
  for (let i = 0; i < steps; i += 1) events.push(...step(session, STEP_MS));
  return events;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('session basics', () => {
  it('starts in the ready phase with a full-health player', () => {
    const session = createSession({ seed: 1, easyMode: false });
    expect(session.phase).toBe('ready');
    expect(session.player.health).toBe(100);
    expect(session.enemies).toEqual([]);
    expect(session.stats).toMatchObject({ throws: 0, perfectParries: 0, score: 0 });
  });

  it('moves the player with move inputs, at the player speed', () => {
    const session = createSession({ seed: 1, easyMode: false });
    session.phase = 'fighting';
    const startX = session.player.x;
    pushInput(session, { type: 'move', dx: 1, dy: 0, at: 0 });
    run(session, 1000);
    expect(session.player.x - startX).toBeCloseTo(TUNING.player.speed, 0);
  });

  it('never lets the player leave the floor band', () => {
    const session = createSession({ seed: 1, easyMode: false });
    session.phase = 'fighting';
    pushInput(session, { type: 'move', dx: -1, dy: -1, at: 0 });
    run(session, 10000);
    expect(session.player.x).toBe(floor.left);
    expect(session.player.y).toBe(floor.top);
    pushInput(session, { type: 'move', dx: 1, dy: 1, at: session.time });
    run(session, 10000);
    expect(session.player.x).toBe(floor.right);
    expect(session.player.y).toBe(floor.bottom);
  });

  it('never reads the real clock', () => {
    const perf = vi.spyOn(performance, 'now');
    const date = vi.spyOn(Date, 'now');
    const session = createSession({ seed: 1, easyMode: false });
    session.phase = 'fighting';
    pushInput(session, { type: 'move', dx: 1, dy: 1, at: 5 });
    run(session, 2000);
    expect(perf).not.toHaveBeenCalled();
    expect(date).not.toHaveBeenCalled();
  });
});

describe('parry timing does not depend on frames (SC-002)', () => {
  // For attacks landing at every millisecond across a step boundary, presses at the start,
  // middle and end of the window must all succeed.
  it('accepts every in-window press whatever the step boundaries', async () => {
    const { createEnemy } = await import('./enemies.js');
    for (let landsAt = 1000; landsAt <= 1000 + Math.ceil(STEP_MS); landsAt += 1) {
      for (const before of [250, 200, 125, 37, 1, 0]) {
        const session = createSession({ seed: 1, easyMode: false });
        session.phase = 'fighting';
        session.time = 600;
        session.player.x = 400;
        session.player.y = 400;
        const enemy = createEnemy({ id: 1, kind: 'walker', x: 460, y: 400, now: 0 });
        Object.assign(enemy, { action: 'windingUp', actionStartedAt: landsAt - 700, attackLandsAt: landsAt });
        session.enemies.push(enemy);
        pushInput(session, { type: 'parry', at: landsAt - before });
        const events = run(session, 600);
        const label = `lands ${landsAt}, press ${before} ms before`;
        expect(events.map((e) => e.type), label).toContain('parried');
        expect(events.map((e) => e.type), label).not.toContain('playerHit');
      }
    }
  });
});

describe('game over (FR-009, FR-017)', () => {
  async function nearlyBeaten() {
    const { createEnemy } = await import('./enemies.js');
    const session = createSession({ seed: 1, easyMode: false });
    session.phase = 'fighting';
    session.player.x = 400;
    session.player.y = 400;
    session.player.health = 10;
    session.stats.score = 350;
    session.enemies.push(createEnemy({ id: 1, kind: 'walker', x: 460, y: 400, now: 0 }));
    return session;
  }

  it('has no result while the game is going', async () => {
    expect(result(await nearlyBeaten())).toBe(null);
  });

  it('ends the game as lost when health reaches 0', async () => {
    const session = await nearlyBeaten();
    const events = run(session, 1000);
    expect(session.player.health).toBe(0);
    expect(session.phase).toBe('lost');
    expect(events.at(-1).type).toBe('gameLost');
    expect(result(session)).toMatchObject({ outcome: 'lost', score: 350 });
  });

  it('stops: nothing moves and inputs do nothing after the game is lost', async () => {
    const session = await nearlyBeaten();
    run(session, 1000);
    const time = session.time;
    pushInput(session, { type: 'move', dx: 1, dy: 0, at: time });
    expect(run(session, 500)).toEqual([]);
    expect(session.time).toBe(time);
  });
});

describe('entrance: walk in, bow, step into the dojo', () => {
  const { intro } = TUNING;

  function started() {
    const session = createSession({ seed: 1, easyMode: false });
    start(session);
    return session;
  }

  it('starts with the player off the left edge, walking in, and no enemies', () => {
    const session = started();
    expect(session.phase).toBe('entering');
    expect(session.player.x).toBeLessThan(0);
    run(session, 200);
    expect(session.player.x).toBeGreaterThan(intro.startX);
    expect(session.enemies).toHaveLength(0);
  });

  it('bows at the edge of the mat, then steps to the middle of the dojo', () => {
    const session = started();
    const trace = [];
    for (let ms = 0; ms < 6000 && session.phase === 'entering'; ms += STEP_MS) {
      step(session, STEP_MS);
      trace.push({ action: session.player.action, x: session.player.x, time: session.time });
    }
    const bowing = trace.filter((s) => s.action === 'bowing');
    expect(bowing.length).toBeGreaterThan(0);
    expect(bowing.every((s) => s.x === intro.bowX)).toBe(true);
    expect(bowing.at(-1).time - bowing[0].time).toBeCloseTo(intro.bowMs, -2);
    // Order: walk in, bow, then step in.
    const firstBow = trace.findIndex((s) => s.action === 'bowing');
    expect(trace.slice(0, firstBow).every((s) => s.x <= intro.bowX)).toBe(true);
    expect(trace.slice(firstBow + bowing.length).every((s) => s.x > intro.bowX)).toBe(true);
    expect(session.phase).toBe('fighting');
    expect(session.player.x).toBe(intro.centerX);
  });

  it('starts the fight, and enemies, only after the entrance', () => {
    const session = started();
    const events = run(session, 4500);
    const fight = events.findIndex((e) => e.type === 'fightStarted');
    expect(fight).toBeGreaterThan(-1);
    expect(session.phase).toBe('fighting');
    run(session, 1000);
    expect(session.enemies.length).toBeGreaterThan(0);
  });

  it('ignores parry and strike during the entrance, but remembers held movement keys', () => {
    const session = started();
    pushInput(session, { type: 'parry', at: 100 });
    pushInput(session, { type: 'strike', at: 100 });
    pushInput(session, { type: 'move', dx: 0, dy: -1, at: 100 });
    const events = run(session, 500);
    expect(events.map((e) => e.type)).not.toContain('missedParry');
    expect(events.map((e) => e.type)).not.toContain('struck');
    expect(session.player.parryReadyAt).toBe(0);
    expect(session.player.move).toEqual({ dx: 0, dy: -1 });
  });
});

describe('hold to block (FR-006a)', () => {
  async function windingUp() {
    const { createEnemy } = await import('./enemies.js');
    const session = createSession({ seed: 1, easyMode: false });
    session.phase = 'fighting';
    session.player.x = 400;
    session.player.y = 400;
    session.time = 1000;
    const enemy = createEnemy({ id: 1, kind: 'walker', x: 460, y: 400, now: 0 });
    Object.assign(enemy, { action: 'windingUp', actionStartedAt: 900, attackLandsAt: 1600 });
    session.enemies.push(enemy);
    return { session, landsAt: 1600 };
  }
  const types = (events) => events.map((e) => e.type);

  it('press inside the window: parry and throw', async () => {
    const { session, landsAt } = await windingUp();
    pushInput(session, { type: 'parry', at: landsAt - 100 });
    const events = run(session, 800);
    expect(types(events)).toContain('parried');
    expect(session.player.health).toBe(100);
  });

  it('press early and keep holding until the hit lands: blocked, no damage, no throw, no points', async () => {
    const { session, landsAt } = await windingUp();
    pushInput(session, { type: 'parry', at: landsAt - 400 });
    const events = run(session, 800);
    expect(types(events)).toContain('blocked');
    expect(types(events)).not.toContain('parried');
    expect(types(events)).not.toContain('missedParry');
    expect(session.player.health).toBe(100);
    expect(session.stats.score).toBe(0);
    expect(session.stats.throws).toBe(0);
  });

  it('stands still in a guard while blocking', async () => {
    const { session, landsAt } = await windingUp();
    pushInput(session, { type: 'parry', at: landsAt - 500 });
    pushInput(session, { type: 'move', dx: -1, dy: 0, at: landsAt - 500 });
    run(session, 200);
    expect(session.player.action).toBe('blocking');
    expect(session.player.x).toBe(400);
  });

  it('letting go after a block does not stumble', async () => {
    const { session, landsAt } = await windingUp();
    pushInput(session, { type: 'parry', at: landsAt - 400 });
    pushInput(session, { type: 'parryRelease', at: landsAt + 100 });
    const events = run(session, 800);
    expect(types(events)).not.toContain('missedParry');
    expect(session.player.stumbleUntil).toBe(0);
  });

  it('press early and let go before the hit lands: stumble from the release, and the hit lands', async () => {
    const { session, landsAt } = await windingUp();
    pushInput(session, { type: 'parry', at: landsAt - 400 });
    pushInput(session, { type: 'parryRelease', at: landsAt - 200 });
    const events = run(session, 800);
    expect(events.find((e) => e.type === 'missedParry')).toMatchObject({ kind: 'early', at: landsAt - 200 });
    expect(session.player.stumbleUntil).toBe(landsAt - 200 + 500);
    expect(types(events)).toContain('playerHit');
    expect(session.player.health).toBe(90);
  });

  it('tapping Space with no attack coming only raises the guard: no stumble, no throw', async () => {
    const session = createSession({ seed: 1, easyMode: false });
    session.phase = 'fighting';
    pushInput(session, { type: 'parry', at: 10 });
    run(session, 100);
    expect(session.player.action).toBe('blocking');
    pushInput(session, { type: 'parryRelease', at: session.time });
    const events = run(session, 100);
    expect(types(events)).toEqual([]);
    expect(session.player.action).toBe('idle');
    expect(session.player.stumbleUntil).toBe(0);
    expect(session.stats.throws).toBe(0);
  });

  it('press after the hit: a miss', async () => {
    const { session, landsAt } = await windingUp();
    run(session, 650);
    pushInput(session, { type: 'parry', at: landsAt + 20 });
    const events = run(session, 100);
    expect(events.find((e) => e.type === 'missedParry')).toMatchObject({ kind: 'late' });
  });

  it('a parry press held on through the next attack blocks it too', async () => {
    const { session, landsAt } = await windingUp();
    const { createEnemy } = await import('./enemies.js');
    pushInput(session, { type: 'parry', at: landsAt - 100 });
    const first = run(session, 1000);
    expect(first.map((e) => e.type)).toContain('parried');
    // Key still held. A new attacker arrives after the throw and its punch lands.
    const second = createEnemy({ id: 2, kind: 'walker', x: 470, y: 400, now: 0 });
    Object.assign(second, { action: 'windingUp', actionStartedAt: session.time, attackLandsAt: session.time + 200 });
    session.enemies.push(second);
    const events = run(session, 400);
    expect(types(events)).toContain('blocked');
    expect(session.player.health).toBe(100);
  });
});
