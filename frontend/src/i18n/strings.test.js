import { describe, expect, it } from 'vitest';
import { strings } from './strings.js';

// Every English key must have a Vietnamese counterpart, so switching language
// never shows a blank label.
function keyPaths(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === 'object' ? keyPaths(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

describe('strings', () => {
  it('has the same keys in English and Vietnamese', () => {
    expect(keyPaths(strings.vi).sort()).toEqual(keyPaths(strings.en).sort());
  });
});
