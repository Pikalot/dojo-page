import { describe, expect, it } from 'vitest';
import { strings } from '../i18n/strings.js';
import { SECTIONS } from '../sections.js';
import { buildPersonIndex, buildSectionIndex, normalize, search } from './search.js';

const index = buildSectionIndex(SECTIONS, strings);
const ids = (results) => results.map((r) => r.id);

describe('normalize', () => {
  it('lowercases, strips Vietnamese diacritics and maps đ to d', () => {
    expect(normalize('Lịch Tập')).toBe('lich tap');
    expect(normalize('Địa điểm')).toBe('dia diem');
    expect(normalize('  Học   phí ')).toBe('hoc phi');
  });
});

describe('search', () => {
  it('returns nothing for an empty or whitespace query', () => {
    expect(search(index, '')).toEqual([]);
    expect(search(index, '   ')).toEqual([]);
  });

  it('matches an English section label by prefix', () => {
    expect(ids(search(index, 'sch'))[0]).toBe('schedule');
  });

  it('matches Vietnamese labels with or without accents', () => {
    expect(ids(search(index, 'lịch tập'))[0]).toBe('schedule');
    expect(ids(search(index, 'lich tap'))[0]).toBe('schedule');
    expect(ids(search(index, 'hoi dap'))[0]).toBe('faq');
  });

  it('matches keywords, not just labels', () => {
    expect(ids(search(index, 'price'))).toEqual(['faq']);
    expect(ids(search(index, 'sensei'))).toEqual(['instructors']);
  });

  it('ranks label matches above keyword matches', () => {
    expect(ids(search(index, 'con'))[0]).toBe('contact');
  });

  it('sends location searches to Contact, where the address and map are', () => {
    for (const query of ['address', 'location', 'where', 'dia chi', 'o dau']) {
      expect(ids(search(index, query))).toEqual(['contact']);
    }
  });

  it('returns several sections when a keyword is shared, in page order', () => {
    expect(ids(search(index, 'class'))).toEqual(['schedule', 'faq']);
  });

  it('finds Instructors by "black belt", in either language', () => {
    for (const query of ['black belt', 'dai den']) expect(ids(search(index, query))).toContain('instructors');
  });

  it('returns nothing when no section matches', () => {
    expect(search(index, 'zzzz')).toEqual([]);
  });
});

describe('person search', () => {
  const godan = { en: 'Godan', vi: 'Ngũ Đẳng' };
  const shodan = { en: 'Shodan', vi: 'Nhất Đẳng' };
  const people = buildPersonIndex({
    instructors: [{ id: 1, name: 'Ann Trần', rank: godan, role: { en: 'Head of Dojo', vi: 'x' } }],
    blackBelts: [{ rank: shodan, members: [{ id: 2, name: 'Bob Lê' }, { id: 3, name: 'Cara Lê' }] }],
  });
  const names = (results) => results.map((r) => r.name);

  it('finds people by first or last name, with or without accents', () => {
    expect(names(search(people, 'ann'))).toEqual(['Ann Trần']);
    expect(names(search(people, 'tran'))).toEqual(['Ann Trần']);
    expect(names(search(people, 'lê'))).toEqual(['Bob Lê', 'Cara Lê']);
  });

  it('lists everyone at a rank, in English or Vietnamese', () => {
    for (const query of ['shodan', 'nhất đẳng', 'nhat dang', 'SHO']) {
      expect(names(search(people, query))).toEqual(['Bob Lê', 'Cara Lê']);
    }
  });

  it('finds a rank by its number, not just its name', () => {
    for (const query of ['1st dan', '1st', 'first dan', 'dan 1', '1 dan', '1st degree', 'đẳng 1', 'dang 1']) {
      expect(names(search(people, query))).toEqual(['Bob Lê', 'Cara Lê']);
    }
    expect(names(search(people, '5th dan'))).toEqual(['Ann Trần']);
    expect(search(people, '2nd dan')).toEqual([]);
  });

  it('finds everyone with "black belt", in either language', () => {
    for (const query of ['black belt', 'BLACK', 'dai den', 'huyền đai']) {
      expect(names(search(people, query))).toEqual(['Ann Trần', 'Bob Lê', 'Cara Lê']);
    }
  });

  it('a rank it has no number for is still found by name', () => {
    const odd = buildPersonIndex({ blackBelts: [{ rank: { en: 'Kudan', vi: 'x' }, members: [{ id: 9, name: 'Z' }] }] });
    expect(names(search(odd, 'kudan'))).toEqual(['Z']);
    expect(search(odd, '9th dan')).toEqual([]);
  });

  it('keeps the person id for highlighting', () => {
    expect(people[1].personId).toBe(2);
  });

  it('does not search by role', () => {
    expect(search(people, 'head of dojo')).toEqual([]);
  });

  it('ranks a name match above a rank match', () => {
    const mixed = buildPersonIndex({
      blackBelts: [
        { rank: { en: 'Sandan', vi: 'x' }, members: [{ id: 1, name: 'Zed' }] },
        { rank: { en: 'Nidan', vi: 'y' }, members: [{ id: 2, name: 'Sandy' }] },
      ],
    });
    expect(names(search(mixed, 'san'))).toEqual(['Sandy', 'Zed']);
  });

  it('opens a profile only for people with a card', () => {
    const [card, listed] = people;
    expect(card).toMatchObject({ profileId: 1, targetId: 'instructors', rank: godan });
    expect(listed).toMatchObject({ profileId: null, targetId: 'black-belts', rank: shodan });
  });

  it('keeps an id of 0 usable, and builds nothing from missing data', () => {
    expect(buildPersonIndex({ instructors: [{ id: 0, name: 'A', rank: godan }] })[0].profileId).toBe(0);
    for (const empty of [null, undefined, {}, { instructors: [], blackBelts: [] }]) {
      expect(buildPersonIndex(empty)).toEqual([]);
    }
  });
});
