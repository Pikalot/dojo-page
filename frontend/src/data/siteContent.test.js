import { describe, expect, it } from 'vitest';
import { getSiteContent, localize } from './siteContent.js';

describe('localize', () => {
  it('resolves nested translations and leaves other values untouched', () => {
    const input = { a: { en: 'Hi', vi: 'Chào' }, list: [{ b: { en: 'x', vi: 'y' }, n: 3 }], s: 'plain' };
    expect(localize(input, 'vi')).toEqual({ a: 'Chào', list: [{ b: 'y', n: 3 }], s: 'plain' });
  });
});

describe('getSiteContent', () => {
  it('contains no unresolved translation objects in either language', () => {
    for (const lang of ['en', 'vi']) {
      const json = JSON.stringify(getSiteContent(lang));
      expect(json).not.toMatch(/"en":/);
      expect(json).not.toMatch(/"vi":/);
    }
  });

  it('gives every list item a unique id', () => {
    const content = getSiteContent('en');
    for (const key of ['announcements', 'schedule', 'fees', 'instructors']) {
      const ids = content[key].map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
