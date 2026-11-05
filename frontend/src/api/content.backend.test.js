import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from './content.js';
import { clearSharedResults } from './shared.js';

const fetched = (body, ok = true, status = 200) =>
  vi.fn(() => Promise.resolve({ ok, status, json: () => Promise.resolve(body) }));

describe('content API with VITE_USE_API', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('turned on', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_USE_API', 'true');
      clearSharedResults();
    });

    it('shares one instructors request between callers', async () => {
      const fetchMock = fetched({ instructors: [] });
      vi.stubGlobal('fetch', fetchMock);
      const [first, second] = await Promise.all([api.getInstructors(), api.getInstructors()]);
      const later = await api.getInstructors();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
      expect(later).toBe(first);
    });

    it('tries again after a failed instructors request', async () => {
      vi.stubGlobal('fetch', fetched({}, false, 500));
      await expect(api.getInstructors()).rejects.toThrow('500');
      const retry = fetched({ instructors: [] });
      vi.stubGlobal('fetch', retry);
      await expect(api.getInstructors()).resolves.toEqual({ instructors: [] });
      expect(retry).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['getAnnouncements', '/api/announcements'],
      ['getSchedule', '/api/schedule'],
      ['getFaq', '/api/faq'],
      ['getInstructors', '/api/instructors'],
      ['getDojoPhotos', '/api/dojo-photos'],
    ])('%s fetches %s', async (name, path) => {
      const fetchMock = fetched(['from backend']);
      vi.stubGlobal('fetch', fetchMock);
      expect(await api[name]()).toEqual(['from backend']);
      expect(fetchMock.mock.calls[0][0]).toBe(path);
    });

    it('rejects on a server error, so the section shows its error message', async () => {
      vi.stubGlobal('fetch', fetched({}, false, 500));
      await expect(api.getSchedule()).rejects.toThrow('500');
    });

    it('rejects when the network fails', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
      await expect(api.getSchedule()).rejects.toThrow('offline');
    });

    it.each(['getAbout', 'getSubcontent', 'getContact', 'getLocation'])(
      '%s stays on mock data, since it has no backend table',
      async (name) => {
        const fetchMock = fetched({});
        vi.stubGlobal('fetch', fetchMock);
        expect(await api[name]()).toBeTruthy();
        expect(fetchMock).not.toHaveBeenCalled();
      },
    );
  });

  it('never calls the network when turned off', async () => {
    const fetchMock = fetched({});
    vi.stubGlobal('fetch', fetchMock);
    await api.getSchedule();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
