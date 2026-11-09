import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { getInstructors } from '../api/content.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { strings } from '../i18n/strings.js';
import { highlightBlackBelt, openInstructorProfile } from '../lib/instructorProfile.js';
import { buildPersonIndex, buildSectionIndex, search } from '../lib/search.js';
import { scrollToSection } from '../lib/scrollToSection.js';
import { SECTIONS } from '../sections.js';
import './SectionSearch.css';

const SECTION_INDEX = buildSectionIndex(SECTIONS, strings);
// Short enough to feel instant, long enough to skip most keystrokes in a word.
const SEARCH_DELAY_MS = 150;

/**
 * Search box for page sections and instructors. Choosing a section jumps to it;
 * choosing an instructor opens their profile, and choosing a black belt, who has
 * no profile, jumps to their name in the list and highlights it. Follows the WAI-ARIA combobox pattern: arrow keys
 * move through results, Enter chooses, Escape closes/clears.
 */
export function SectionSearch({ onNavigate }) {
  const { language, t } = useLanguage();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (i) => `${baseId}-option-${i}`;

  const [people, setPeople] = useState([]);
  const peopleRequested = useRef(false);

  const index = useMemo(() => [...SECTION_INDEX, ...people], [people]);
  const [searchedQuery, flushSearch] = useDebouncedValue(query, SEARCH_DELAY_MS);
  const results = useMemo(() => search(index, searchedQuery), [index, searchedQuery]);
  // Until this is true, results describe an earlier query, so "no matches" would be a guess.
  const settled = searchedQuery === query;
  const showPopup = open && query.trim() !== '';

  // Loaded on first use, so a page view with no search costs no extra request.
  // If it fails, sections still work, and the next focus tries again.
  const loadPeople = () => {
    if (peopleRequested.current) return;
    peopleRequested.current = true;
    getInstructors().then(
      (data) => setPeople(buildPersonIndex(data)),
      () => {
        peopleRequested.current = false;
      },
    );
  };

  // A long list scrolls, so keep the option chosen by arrow key in view. Not for
  // the mouse, which would make the list move under the pointer.
  const movedByKeyboard = useRef(false);
  useEffect(() => {
    if (activeIndex >= 0 && movedByKeyboard.current) {
      document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: 'nearest' });
    }
    movedByKeyboard.current = false;
    // optionId only changes with baseId, which is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const select = (entry) => {
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
    if (entry.type !== 'person') {
      scrollToSection(entry.targetId);
    } else if (entry.profileId === null) {
      // The Instructors section scrolls to the name itself.
      scrollToSection(entry.targetId, { scroll: false });
      highlightBlackBelt(entry.personId);
    } else {
      // Instant, because the open modal stops the page from scrolling. Focus
      // goes to the section first, so closing the modal returns there.
      scrollToSection(entry.targetId, { instant: true });
      openInstructorProfile(entry.profileId);
    }
    onNavigate?.();
  };

  const handleKeyDown = (event) => {
    // These act on what is typed now, even if the debounced list hasn't caught up.
    const current = settled ? results : search(index, query);
    switch (event.key) {
      case 'ArrowDown':
        if (!current.length) return;
        event.preventDefault();
        flushSearch();
        setOpen(true);
        movedByKeyboard.current = true;
        setActiveIndex((i) => (i + 1) % current.length);
        break;
      case 'ArrowUp':
        if (!current.length) return;
        event.preventDefault();
        flushSearch();
        setOpen(true);
        movedByKeyboard.current = true;
        setActiveIndex((i) => (i <= 0 ? current.length - 1 : i - 1));
        break;
      case 'Enter':
        event.preventDefault();
        if (current.length) select(current[activeIndex >= 0 ? activeIndex : 0]);
        break;
      case 'Escape':
        // Browsers clear a search input on Escape; closing the list comes first.
        event.preventDefault();
        if (showPopup) {
          setOpen(false);
          setActiveIndex(-1);
        } else {
          setQuery('');
        }
        break;
      default:
    }
  };

  return (
    <div className="section-search" role="search">
      <label htmlFor={`${baseId}-input`} className="visually-hidden">
        {t.search.label}
      </label>
      <input
        id={`${baseId}-input`}
        className="section-search__input"
        type="search"
        role="combobox"
        autoComplete="off"
        spellCheck="false"
        placeholder={t.search.placeholder}
        aria-autocomplete="list"
        aria-expanded={showPopup}
        aria-controls={listboxId}
        aria-activedescendant={showPopup && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          setOpen(true);
          loadPeople();
        }}
        onBlur={() => setOpen(false)}
      />
      <svg className="section-search__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>

      <ul
        id={listboxId}
        role="listbox"
        aria-label={t.search.label}
        className="section-search__results"
        hidden={!showPopup || results.length === 0}
        // Keep focus in the input, so the blur handler does not close the list first.
        onMouseDown={(e) => e.preventDefault()}
      >
        {results.map((entry, i) => (
          <li
            key={entry.id}
            id={optionId(i)}
            role="option"
            aria-selected={i === activeIndex}
            className="section-search__option"
            onClick={() => select(entry)}
            onMouseMove={() => setActiveIndex(i)}
          >
            {entry.type === 'person' ? (
              <>
                {entry.name} <span className="section-search__detail">{entry.rank[language]}</span>
              </>
            ) : (
              entry.labels[language]
            )}
          </li>
        ))}
      </ul>
      {showPopup && settled && results.length === 0 && (
        <p className="section-search__empty">{t.search.noResults}</p>
      )}

      <div className="visually-hidden" aria-live="polite">
        {showPopup && settled ? (results.length ? t.search.resultsCount(results.length) : t.search.noResults) : ''}
      </div>
    </div>
  );
}
