import { describe, expect, it } from 'vitest';
import { createRandom } from './random.js';

const take = (rng, n) => Array.from({ length: n }, () => rng.next());

describe('createRandom', () => {
  it('gives the same sequence for the same seed', () => {
    expect(take(createRandom(42), 20)).toEqual(take(createRandom(42), 20));
  });

  it('gives different sequences for different seeds', () => {
    expect(take(createRandom(1), 20)).not.toEqual(take(createRandom(2), 20));
  });

  it('returns values in [0, 1)', () => {
    for (const value of take(createRandom(7), 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('int(min, max) stays within both bounds, inclusive', () => {
    const rng = createRandom(3);
    const values = Array.from({ length: 2000 }, () => rng.int(1000, 2500));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(1000);
    expect(Math.max(...values)).toBeLessThanOrEqual(2500);
    expect(values.every(Number.isInteger)).toBe(true);
  });
});
