import { STEP_MS } from './tuning.js';

const MAX_STEPS_PER_FRAME = 5;

/**
 * Fixed-step clock. The UI passes in real timestamps (from requestAnimationFrame and
 * event.timeStamp); the clock never reads the time itself. Simulation time excludes
 * paused time, so `toSimTime` puts each key press at the right moment of the game.
 */
export function createClock() {
  let started = false;
  let paused = false;
  let pausedAt = 0;
  // simulation time = real time - offset
  let offset = 0;
  let simTime = 0;

  return {
    get simTime() {
      return simTime;
    },
    get paused() {
      return paused;
    },
    start(now) {
      started = true;
      paused = false;
      offset = now;
      simTime = 0;
    },
    /** Returns how many fixed steps to run for a frame at real time `now`. */
    advance(now) {
      if (!started || paused) return 0;
      const target = now - offset;
      let steps = Math.floor((target - simTime + 1e-9) / STEP_MS);
      if (steps <= 0) return 0;
      if (steps > MAX_STEPS_PER_FRAME) {
        steps = MAX_STEPS_PER_FRAME;
        simTime += steps * STEP_MS;
        // Drop the backlog so a long frame doesn't cause a spiral of catch-up frames.
        offset = now - simTime;
        return steps;
      }
      simTime += steps * STEP_MS;
      return steps;
    },
    pause(now) {
      if (!started || paused) return;
      paused = true;
      pausedAt = now;
    },
    resume(now) {
      if (!paused) return;
      paused = false;
      offset += now - pausedAt;
    },
    toSimTime(timeStamp) {
      return timeStamp - offset;
    },
  };
}
