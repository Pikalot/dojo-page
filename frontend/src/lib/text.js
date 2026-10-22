// Turns plain text typed by an editor into display pieces, so editors never
// have to split content themselves.

/** Splits text into paragraphs on blank lines. */
export function toParagraphs(text = '') {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Splits text into its non-empty lines (e.g. a multi-line address). */
export function toLines(text = '') {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
