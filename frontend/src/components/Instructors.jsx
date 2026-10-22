import { useCallback, useEffect, useRef, useState } from 'react';
import { getInstructors } from '../api/content.js';
import { useContent } from '../hooks/useContent.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { toParagraphs } from '../lib/text.js';
import { ContentStatus } from './ContentStatus.jsx';
import './Instructors.css';

/**
 * Horizontally scrolling row of instructor cards. Works with touch swipe,
 * trackpad, the arrow buttons, or the keyboard (the row is focusable, so
 * arrow keys scroll it natively).
 */
export function Instructors() {
  const { t } = useLanguage();
  const { status, data: instructors } = useContent(getInstructors);
  const trackRef = useRef(null);
  const [canScroll, setCanScroll] = useState({ back: false, forward: false });

  const updateButtons = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // 2px tolerance for sub-pixel rounding.
    setCanScroll({ back: el.scrollLeft > 2, forward: el.scrollLeft < max - 2 });
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    updateButtons();
    el.addEventListener('scroll', updateButtons, { passive: true });
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateButtons) : null;
    resizeObserver?.observe(el);
    return () => {
      el.removeEventListener('scroll', updateButtons);
      resizeObserver?.disconnect();
    };
  }, [updateButtons, instructors]);

  const scrollByPage = (direction) => {
    const el = trackRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  return (
    <section id="instructors" className="section instructors" aria-labelledby="instructors-title">
      <div className="instructors__header container">
        <h2 id="instructors-title" className="section__title instructors__title" tabIndex={-1}>
          {t.sections.instructors}
        </h2>
        <div className="instructors__controls">
          <button
            type="button"
            className="scroll-button"
            aria-label={t.instructors.previous}
            aria-controls="instructor-track"
            disabled={!canScroll.back}
            onClick={() => scrollByPage(-1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="scroll-button"
            aria-label={t.instructors.next}
            aria-controls="instructor-track"
            disabled={!canScroll.forward}
            onClick={() => scrollByPage(1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="container">
        <ContentStatus status={status} />
      </div>

      {/* Focusable so keyboard users can scroll it with the arrow keys. */}
      <div
        id="instructor-track"
        ref={trackRef}
        className="instructors__track"
        role="region"
        aria-label={t.instructors.listLabel}
        tabIndex={0}
      >
        <ul className="instructors__list">
          {instructors?.map((person) => (
            <li key={person.id} className="instructor-card">
              <div className="instructor-card__photo">
                {/* PLACEHOLDER: generic silhouette until real photos are supplied. */}
                <svg viewBox="0 0 80 80" role="img" aria-label={t.instructors.photoPlaceholder(person.name)}>
                  <circle cx="40" cy="30" r="14" fill="currentColor" />
                  <path d="M14 72c2-16 13-24 26-24s24 8 26 24z" fill="currentColor" />
                </svg>
              </div>
              <h3 className="instructor-card__name">{person.name}</h3>
              <p className="instructor-card__meta">
                {person.role} · {person.rank}
              </p>
              {toParagraphs(person.bio).map((text, i) => (
                <p key={i} className="instructor-card__bio">
                  {text}
                </p>
              ))}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
