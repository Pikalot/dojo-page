import { useId, useMemo, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { strings } from '../i18n/strings.js';
import { buildSectionIndex, search } from '../lib/search.js';
import { scrollToSection } from '../lib/scrollToSection.js';
import { SECTIONS } from '../sections.js';
import './SectionSearch.css';

const INDEX = buildSectionIndex(SECTIONS, strings);

/**
 * Search box that jumps to a page section. Follows the WAI-ARIA combobox
 * pattern: arrow keys move through results, Enter jumps, Escape closes/clears.
 */
export function SectionSearch({ onNavigate }) {
  const { language, t } = useLanguage();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (i) => `${baseId}-option-${i}`;

  const results = useMemo(() => search(INDEX, query), [query]);
  const showPopup = open && query.trim() !== '';

  const select = (entry) => {
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
    scrollToSection(entry.targetId);
    onNavigate?.();
  };

  const handleKeyDown = (event) => {
    switch (event.key) {
      case 'ArrowDown':
        if (!results.length) return;
        event.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (i + 1) % results.length);
        break;
      case 'ArrowUp':
        if (!results.length) return;
        event.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
        break;
      case 'Enter':
        event.preventDefault();
        if (results.length) select(results[activeIndex >= 0 ? activeIndex : 0]);
        break;
      case 'Escape':
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
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      <svg className="section-search__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>

      <ul id={listboxId} role="listbox" aria-label={t.search.label} className="section-search__results" hidden={!showPopup}>
        {results.map((entry, i) => (
          <li
            key={entry.id}
            id={optionId(i)}
            role="option"
            aria-selected={i === activeIndex}
            className="section-search__option"
            // Keep focus in the input so the blur handler does not close the list first.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => select(entry)}
            onMouseMove={() => setActiveIndex(i)}
          >
            {entry.labels[language]}
          </li>
        ))}
      </ul>
      {showPopup && results.length === 0 && (
        <p className="section-search__empty">{t.search.noResults}</p>
      )}

      <div className="visually-hidden" aria-live="polite">
        {showPopup ? (results.length ? t.search.resultsCount(results.length) : t.search.noResults) : ''}
      </div>
    </div>
  );
}
