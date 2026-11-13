import { describe, expect, it } from 'vitest';
import { gameStrings } from './game.js';

// Same check as strings.test.js: every English key has a Vietnamese counterpart.
function keyPaths(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === 'object' ? keyPaths(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

describe('gameStrings', () => {
  it('has the same keys in English and Vietnamese', () => {
    expect(keyPaths(gameStrings.vi).sort()).toEqual(keyPaths(gameStrings.en).sort());
  });

  it('has no empty text', () => {
    for (const language of ['en', 'vi']) {
      for (const path of keyPaths(gameStrings[language])) {
        const value = path.split('.').reduce((node, key) => node[key], gameStrings[language]);
        expect(value, `${language}.${path}`).not.toBe('');
      }
    }
  });

  it('keeps "Aikido" untranslated in the title', () => {
    expect(gameStrings.en.game.meta.title).toContain('Aikido');
    expect(gameStrings.vi.game.meta.title).toContain('Aikido');
  });
});
