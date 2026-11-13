/** Seeded random numbers (mulberry32), so a seed and the same inputs always replay the same game. */
export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** Whole number from min to max, both included. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
  };
}
