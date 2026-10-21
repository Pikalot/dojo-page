import { describe, expect, it } from 'vitest';
import { strings } from '../i18n/strings.js';
import { SECTIONS } from '../sections.js';
import { buildSectionIndex, normalize, search } from './search.js';

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
    expect(ids(search(index, 'hoc phi'))[0]).toBe('fees');
  });

  it('matches keywords, not just labels', () => {
    expect(ids(search(index, 'price'))).toEqual(['fees']);
    expect(ids(search(index, 'sensei'))).toEqual(['instructors']);
  });

  it('ranks label matches above keyword matches', () => {
    // "contact" is a label; "address" keywords also point at about/contact.
    expect(ids(search(index, 'con'))[0]).toBe('contact');
  });

  it('returns several sections when a keyword is shared, in page order', () => {
    expect(ids(search(index, 'address'))).toEqual(['about', 'contact']);
  });

  it('returns nothing when no section matches', () => {
    expect(search(index, 'zzzz')).toEqual([]);
  });
});
