// Client-side search over page sections and instructors. It runs entirely in the
// browser, so what a visitor types is never sent to the server. Entries carry a
// `type`, because sections and people behave differently when chosen.

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

// Everyone on the Instructors page holds a dan rank, so all of these find them.
const BLACK_BELT_TERMS = ['black belt', 'đai đen', 'huyền đai'];
// Rank names as visitors may not know them. Keyed by the English rank name.
const DAN_NUMBERS = {
  shodan: ['1', '1st', 'first'],
  nidan: ['2', '2nd', 'second'],
  sandan: ['3', '3rd', 'third'],
  yondan: ['4', '4th', 'fourth'],
  godan: ['5', '5th', 'fifth'],
  rokudan: ['6', '6th', 'sixth'],
};

function rankTerms(rank) {
  const [digit, ordinal, word] = DAN_NUMBERS[normalize(rank.en ?? '')] ?? [];
  const numbered = digit
    ? [`${ordinal} dan`, `${word} dan`, `${digit} dan`, `dan ${digit}`, `${ordinal} degree`, `đẳng ${digit}`, `${digit} đẳng`]
    : [];
  return [...Object.values(rank), ...numbered, ...BLACK_BELT_TERMS].map(normalize);
}

/**
 * Builds entries for everyone in the instructors response. People are found by
 * name or by rank in any language, but not by role. `profileId` is set only for
 * those with a card, because black belts have no profile to open.
 */
export function buildPersonIndex(data) {
  const entry = (person, rank, hasProfile) => ({
    id: `person-${person.id}`,
    type: 'person',
    personId: person.id,
    targetId: hasProfile ? 'instructors' : 'black-belts',
    profileId: hasProfile ? person.id : null,
    name: person.name,
    rank,
    labelTerms: [normalize(person.name)],
    keywordTerms: rankTerms(rank),
  });
  return [
    ...(data?.instructors ?? []).map((person) => entry(person, person.rank, true)),
    ...(data?.blackBelts ?? []).flatMap((group) =>
      group.members.map((member) => entry(member, group.rank, false)),
    ),
  ];
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
