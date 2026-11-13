import { describe, expect, it } from 'vitest';
import { createEnemy } from '../engine/enemies.js';
import { createSession } from '../engine/session.js';
import { drawFrame, enemyFrame, playerFrame } from './draw.js';
import SPRITES from './sprites/sprites.json';

/** A stand-in 2D context that accepts every call and remembers the transform. */
function fakeContext(width = 1280, height = 720) {
  const calls = [];
  const ctx = new Proxy(
    { canvas: { width, height } },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        return (...args) => calls.push([prop, args]);
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    },
  );
  return { ctx, calls };
}

const ENEMY_ACTIONS = ['approaching', 'windingUp', 'attacking', 'recovering', 'pushedBack',
  'dashWindUp', 'spinning', 'overshoot', 'thrown', 'defeated'];
const PLAYER_ACTIONS = ['idle', 'moving', 'entering', 'bowing', 'striking', 'blocking',
  'stumbling', 'hit', 'throwing'];

function sessionWithEveryAction() {
  const session = createSession({ seed: 1 });
  session.time = 1000;
  ENEMY_ACTIONS.forEach((action, i) => {
    // Only dashers crouch, spin and skid; the rest alternate between the two kinds.
    const dasherOnly = ['dashWindUp', 'spinning', 'overshoot'].includes(action);
    const kind = dasherOnly || i % 2 ? 'dasher' : 'walker';
    const enemy = createEnemy({ id: i + 1, kind, x: 100 + i * 80, y: 400 });
    Object.assign(enemy, {
      action, actionStartedAt: 900, critical: true, delayUsed: true, nextAttackNotBefore: 2000,
      dashDir: -1, fromX: 100 + i * 80, toX: 20 + i * 80,
    });
    session.enemies.push(enemy);
  });
  return session;
}

describe('sprite frames', () => {
  it('every enemy action shows a frame that exists on its sheet, at every moment', () => {
    const session = sessionWithEveryAction();
    for (const enemy of session.enemies) {
      for (let t = 900; t < 1700; t += 20) {
        session.time = t;
        const { frame, facing } = enemyFrame(enemy, session);
        expect(SPRITES.characters[enemy.kind].frames, `${enemy.kind} ${enemy.action}`).toContain(frame);
        expect([1, -1]).toContain(facing);
      }
    }
  });

  it('every player action shows a frame that exists on both aikidoka sheets', () => {
    const player = createSession({ seed: 1 }).player;
    for (const action of PLAYER_ACTIONS) {
      for (let t = 0; t < 500; t += 25) {
        const { frame } = playerFrame({ ...player, action, actionEndsAt: 500 }, t);
        expect(SPRITES.characters.male.frames, action).toContain(frame);
        expect(SPRITES.characters.female.frames, action).toContain(frame);
      }
    }
  });

  it('the whirlwind kick hops, then loops through four spin frames', () => {
    const session = sessionWithEveryAction();
    const kicker = session.enemies.find((e) => e.action === 'spinning');
    const seen = [];
    for (let t = 900; t < 1300; t += 30) {
      session.time = t;
      seen.push(enemyFrame(kicker, session).frame);
    }
    expect(seen[0]).toBe('hop');
    expect(new Set(seen)).toEqual(new Set(['hop', 'spinFront', 'spinToward', 'spinBehind', 'spinAway']));
  });

  it('a thrown enemy rises over the player and comes down', () => {
    const session = sessionWithEveryAction();
    const thrown = session.enemies.find((e) => e.action === 'thrown');
    session.time = 900 + 250;
    expect(enemyFrame(thrown, session).lift).toBeGreaterThan(100);
    session.time = 900 + 495;
    expect(enemyFrame(thrown, session).lift).toBeLessThan(10);
  });
});

describe('drawFrame', () => {
  it('draws every action, for both characters and both motion settings, without errors', () => {
    const session = sessionWithEveryAction();
    for (const action of PLAYER_ACTIONS) {
      session.player.action = action;
      session.player.actionEndsAt = 1200;
      for (const character of ['male', 'female']) {
        for (const reducedMotion of [false, true]) {
          const { ctx, calls } = fakeContext();
          expect(() => drawFrame(ctx, session, { reducedMotion, character })).not.toThrow();
          expect(calls.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('letterboxes the stage without stretching', () => {
    const { ctx, calls } = fakeContext(1000, 1000);
    drawFrame(ctx, createSession({ seed: 1 }));
    const transforms = calls.filter(([name]) => name === 'setTransform').map(([, args]) => args);
    const [scaleX, , , scaleY] = transforms.at(-1);
    expect(scaleX).toBe(scaleY);
  });
});
