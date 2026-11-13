import { describe, expect, it } from 'vitest';
import { createClock } from './clock.js';
import { STEP_MS } from './tuning.js';

describe('createClock', () => {
  it('runs floor(elapsed / step) steps and carries the remainder', () => {
    const clock = createClock();
    clock.start(1000);
    expect(clock.advance(1000 + STEP_MS * 2.5)).toBe(2);
    // The half step left over completes on the next frame.
    expect(clock.advance(1000 + STEP_MS * 3)).toBe(1);
    expect(clock.simTime).toBeCloseTo(STEP_MS * 3);
  });

  it('runs no steps before start or while paused', () => {
    const clock = createClock();
    expect(clock.advance(500)).toBe(0);
    clock.start(0);
    clock.pause(100);
    expect(clock.advance(5000)).toBe(0);
  });

  it('runs at most 5 steps per frame and drops the backlog after a long frame', () => {
    const clock = createClock();
    clock.start(0);
    expect(clock.advance(1000)).toBe(5);
    // Real time and simulation time line up again, so the next frame is normal.
    expect(clock.advance(1000 + STEP_MS)).toBe(1);
  });

  it('maps event timestamps to simulation time', () => {
    const clock = createClock();
    clock.start(2000);
    expect(clock.toSimTime(2250)).toBe(250);
  });

  it('excludes paused time from simulation time', () => {
    const clock = createClock();
    clock.start(0);
    clock.advance(STEP_MS * 3);
    clock.advance(STEP_MS * 6);
    clock.pause(STEP_MS * 6);
    clock.resume(STEP_MS * 6 + 3000);
    expect(clock.toSimTime(STEP_MS * 6 + 3000 + 40)).toBeCloseTo(STEP_MS * 6 + 40);
    expect(clock.advance(STEP_MS * 7 + 3000)).toBe(1);
  });

  it('calling pause twice or resume while running changes nothing', () => {
    const clock = createClock();
    clock.start(0);
    clock.resume(500);
    expect(clock.toSimTime(600)).toBe(600);
    clock.pause(600);
    clock.pause(900);
    clock.resume(1600);
    expect(clock.toSimTime(1700)).toBe(700);
  });
});
