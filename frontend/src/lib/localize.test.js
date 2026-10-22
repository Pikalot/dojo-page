import { describe, expect, it } from 'vitest';
import { localize } from './localize.js';

describe('localize', () => {
  it('resolves nested translations and leaves other values untouched', () => {
    const input = { a: { en: 'Hi', vi: 'Chào' }, list: [{ b: { en: 'x', vi: 'y' }, n: 3 }], s: 'plain' };
    expect(localize(input, 'vi')).toEqual({ a: 'Chào', list: [{ b: 'y', n: 3 }], s: 'plain' });
  });

  it('falls back to English when a translation is missing', () => {
    expect(localize({ en: 'Hi', vi: undefined }, 'vi')).toBe('Hi');
  });
});
