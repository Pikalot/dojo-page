import { useCallback, useEffect, useRef, useState } from 'react';
import { getInstructors } from '../api/content.js';
import { useContent } from '../hooks/useContent.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { toParagraphs } from '../lib/text.js';
import { ContentStatus } from './ContentStatus.jsx';
import './Instructors.css';
import { useTilt } from '../hooks/useTilt.js';
import { useInView } from '../hooks/useInView.js';
import tenshinkaiLogo from '../assets/tenshinkai-logo.svg';

/**
 * Horizontally scrolling row of instructor cards. Works with touch swipe,
 * trackpad, the arrow buttons, or the keyboard (the row is focusable, so
 * arrow keys scroll it natively).
 */
export function Instructors() {
  const { t } = useLanguage();
  const { status, data } = useContent(getInstructors);
  // Teaching staff get cards; every other black belt goes in the list below.
  const instructors = data?.instructors;
  const blackBelts = data?.blackBelts;
  const trackRef = useRef(null);
  const [canScroll, setCanScroll] = useState({ back: false, forward: false });
  const billboardRef = useRef(null)
  useTilt(billboardRef)
  const dialogRef = useRef(null);
  const [profileId, setProfileId] = useState(null);
  // Looked up by id, so the open profile follows a language switch.
  const profile = instructors?.find((person) => person.id === profileId);

  // Open the modal once its content has rendered; the browser handles
  // centering, the backdrop, Esc, and returning focus to the card on close.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (profile && dialog && !dialog.open) dialog.showModal();
  }, [profile]);

  // A click on the dialog element itself (not its content) is on the backdrop.
  const closeOnBackdrop = (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  };

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
        <ul className="instructors__list billboard" ref={billboardRef}>
          {instructors?.map((person) => (
            <li key={person.id} className="instructor-card">
              <InstructorPhoto photo={person.photo} alt={t.instructors.photoAlt(person.name)} />
              <h3 className="instructor-card__name">
                {/* Its click area stretches over the whole card (see Instructors.css). */}
                <button
                  type="button"
                  className="instructor-card__open"
                  aria-haspopup="dialog"
                  onClick={() => setProfileId(person.id)}
                >
                  {person.name}
                </button>
              </h3>
              <p className="instructor-card__meta">
                {person.role}
                <br/>
                {person.rank}
              </p>
              <div className="instructor-card__bio-wrap">
                {toParagraphs(person.bio).map((text, i) => (
                  <p key={i} className="instructor-card__bio">
                    {text}
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {blackBelts?.length > 0 && <BlackBelts groups={blackBelts} />}

      <dialog
        ref={dialogRef}
        className="instructor-modal"
        aria-labelledby="instructor-modal-name"
        onClose={() => setProfileId(null)}
        onClick={closeOnBackdrop}
      >
        {profile && (
          <div className="instructor-modal__body">
            <button
              type="button"
              className="instructor-modal__close"
              aria-label={t.instructors.close}
              onClick={() => dialogRef.current.close()}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>
            <InstructorPhoto photo={profile.photo} alt={t.instructors.photoAlt(profile.name)} />
            <h2 id="instructor-modal-name" className="instructor-modal__name">
              {profile.name}
            </h2>
            <p className="instructor-card__meta instructor-modal__meta">
              {profile.role} · {profile.rank}
            </p>
            {toParagraphs(profile.bio).map((text, i) => (
              <p key={i} className="instructor-modal__bio">
                {text}
              </p>
            ))}
          </div>
        )}
      </dialog>
    </section>
  );
}

/**
 * Every black belt who is not on a card, already grouped by rank and in
 * order by the API.
 */
function BlackBelts({ groups }) {
  const { t } = useLanguage();
  const billboardRef = useRef(null);
  useTilt(billboardRef);
  const separatorRef = useRef(null);
  const separatorInView = useInView(separatorRef, 0.6);
  const groupsInView = useInView(billboardRef, 0.1);

  return (
    <div className="black-belts container">
      {/* Decorative: the throw plays as a quick strike each time it scrolls into view. */}
      <div
        ref={separatorRef}
        className="black-belts__separator"
        data-visible={separatorInView}
        aria-hidden="true"
      >
        <span className="black-belts__art" />
      </div>
      <h2 className="black-belts__title">{t.instructors.blackBelts}</h2>
      <div className="black-belts__groups billboard" ref={billboardRef}>
        {/* Same pop-up as the panels above, one box after another. */}
        {groups.map(({ rank, members }, i) => (
          <div
            key={rank}
            className="black-belts__group reveal"
            data-visible={groupsInView}
            style={{ '--reveal-index': i }}
          >
            <h3 className="black-belts__rank">{rank}</h3>
            <ul className="black-belts__names">
              {members.map(({ id, name }) => (
                <li key={id}>{name}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The instructor's photo, or the dojo logo when they have none: `photo` is
 * optional, and an empty string or a URL that fails to load counts as none.
 */
function InstructorPhoto({ photo, alt }) {
  const [failed, setFailed] = useState(null);
  const hasPhoto = Boolean(photo) && failed !== photo;

  return (
    <div className="instructor-card__photo" data-fallback={!hasPhoto}>
      {hasPhoto ? (
        <img src={photo} alt={alt} loading="lazy" onError={() => setFailed(photo)} />
      ) : (
        // Decorative: the name is right below it.
        <img src={tenshinkaiLogo} alt="" />
      )}
    </div>
  );
}
