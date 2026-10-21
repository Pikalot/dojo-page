import { describe, expect, it } from 'vitest';
import { formatDate, formatTime } from './format.js';

describe('formatTime', () => {
  it('uses 12-hour time in English and 24-hour time in Vietnamese', () => {
    expect(formatTime('19:00', 'en').replace(/\s/g, ' ')).toBe('7:00 PM');
    expect(formatTime('19:00', 'vi')).toBe('19:00');
  });
});

describe('formatDate', () => {
  it('does not shift the day across timezones', () => {
    expect(formatDate('2026-11-01', 'en')).toBe('November 1, 2026');
  });

  it('formats dates in Vietnamese', () => {
    expect(formatDate('2026-11-01', 'vi')).toMatch(/2026/);
    expect(formatDate('2026-11-01', 'vi')).toMatch(/11/);
  });
});
