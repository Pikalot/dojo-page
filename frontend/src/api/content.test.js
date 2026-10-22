import { describe, expect, it } from 'vitest';
import { localize } from '../lib/localize.js';
import * as api from './content.js';

// Checks the mock data has the shape the components (and the future API) rely on.
const resources = Object.entries(api);

describe('content API (mock)', () => {
  it.each(resources)('%s resolves with data', async (_name, load) => {
    expect(await load()).toBeTruthy();
  });

  it.each(resources)('%s has no unresolved translations after localizing', async (_name, load) => {
    for (const language of ['en', 'vi']) {
      const json = JSON.stringify(localize(await load(), language));
      expect(json).not.toMatch(/"(en|vi)":/);
    }
  });

  it('gives every list item a unique id', async () => {
    const lists = [
      await api.getAnnouncements(),
      await api.getSchedule(),
      (await api.getFees()).items,
      await api.getInstructors(),
    ];
    for (const list of lists) {
      const ids = list.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('stores editor text as single strings, not pre-split lists', async () => {
    expect(typeof (await api.getAbout()).body.en).toBe('string');
    expect(typeof (await api.getLocation()).address).toBe('string');
  });
});
