import { describe, expect, it } from 'vitest';
import { toLines, toParagraphs } from './text.js';

describe('toParagraphs', () => {
  it('splits on blank lines, including lines with only spaces', () => {
    expect(toParagraphs('One.\n\nTwo.\n  \nThree.')).toEqual(['One.', 'Two.', 'Three.']);
  });

  it('keeps single line breaks inside a paragraph', () => {
    expect(toParagraphs('Line a\nline b')).toEqual(['Line a\nline b']);
  });

  it('ignores extra blank lines and surrounding whitespace', () => {
    expect(toParagraphs('\n\n  One.  \n\n\n\nTwo.\n\n')).toEqual(['One.', 'Two.']);
  });

  it('returns nothing for empty or missing text', () => {
    expect(toParagraphs('')).toEqual([]);
    expect(toParagraphs(undefined)).toEqual([]);
  });
});

describe('toLines', () => {
  it('splits an address into trimmed, non-empty lines', () => {
    expect(toLines(' 1 Main St \n\nSan Jose, CA ')).toEqual(['1 Main St', 'San Jose, CA']);
  });
});
