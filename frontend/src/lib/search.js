// Client-side search over page sections. Entries carry a `type` so other kinds
// of results (e.g. instructors by name or rank) can be added to the same index later.

/**
 * Lowercases and strips diacritics so "lich tap" matches "Lịch tập".
 * NFD splits most Vietnamese letters into base + combining marks, but "đ" is
 * a distinct letter and needs an explicit mapping.
 */
export function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Builds index entries for every section, matching against labels and keywords
 * in all languages so a search works regardless of the selected language.
 */
export function buildSectionIndex(sections, strings) {
  return sections.map((section) => {
    const labels = Object.fromEntries(
      Object.entries(strings).map(([lang, s]) => [lang, s.nav[section.navKey]]),
    );
    const keywords = Object.values(section.keywords).flat();
    return {
      id: section.id,
      type: 'section',
      targetId: section.id,
      labels,
      labelTerms: Object.values(labels).map(normalize),
      keywordTerms: keywords.map(normalize),
    };
  });
}

function scoreEntry(entry, query) {
  const startsWord = (term) => term.startsWith(query) || term.includes(` ${query}`);
  if (entry.labelTerms.some((t) => t.startsWith(query))) return 4;
  if (entry.labelTerms.some(startsWord)) return 3;
  if (entry.keywordTerms.some(startsWord)) return 2;
  if ([...entry.labelTerms, ...entry.keywordTerms].some((t) => t.includes(query))) return 1;
  return 0;
}

/** Returns matching entries, best matches first; ties keep page order. */
export function search(index, rawQuery) {
  const query = normalize(rawQuery);
  if (!query) return [];
  return index
    .map((entry, order) => ({ entry, order, score: scoreEntry(entry, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((r) => r.entry);
}
