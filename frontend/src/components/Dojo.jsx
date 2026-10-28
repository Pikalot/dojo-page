import { useRef } from 'react';
import { getAbout, getDojoPhotos } from '../api/content.js';
import { useCarousel } from '../hooks/useCarousel.js';
import { useContent } from '../hooks/useContent.js';
import { useInView } from '../hooks/useInView.js';
import { useTilt } from '../hooks/useTilt.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { toParagraphs } from '../lib/text.js';
import { ContentStatus } from './ContentStatus.jsx';
import './About.css';
import './Dojo.css';

// Photo entrance effect: 'zoom' (zoom settle) or 'wipe' (center-out reveal).
// Styles for each are in About.css.
const PHOTO_EFFECT = 'wipe';

export function Dojo() {
  const { t } = useLanguage();
  const about = useContent(getAbout);
  const { data: photos } = useContent(getDojoPhotos);
  const count = photos?.length ?? 0;
  const photoRef = useRef(null);
  const photoInView = useInView(photoRef);
  const billboardRef = useRef(null);
  useTilt(billboardRef);

  const trackRef = useRef(null);
  const carousel = useCarousel(trackRef, count);
  const viewerRef = useRef(null);
  const viewerTrackRef = useRef(null);
  const viewer = useCarousel(viewerTrackRef, count);

  // Wraps around at both ends.
  const step = (target, direction) => target.goTo((target.index + direction + count) % count);

  // The dialog is always in the page (hidden while closed), so it can open
  // straight on the clicked photo. The browser handles Esc and returns focus.
  const openViewer = (index) => {
    viewerRef.current.showModal();
    viewer.goTo(index, { instant: true });
  };

  // Leave the inline carousel on the photo last seen in the viewer.
  const syncFromViewer = () => carousel.goTo(viewer.index, { instant: true });

  const onViewerKeyDown = (event) => {
    if (event.key === 'ArrowLeft') step(viewer, -1);
    if (event.key === 'ArrowRight') step(viewer, 1);
  };

  return (
    <section id="dojo" className="section about" aria-labelledby="about-title">
      <div className="container">
        <h2 id="dojo-title" className="section__title about__title" tabIndex={-1}>
          {t.sections.about}
        </h2>

        <ContentStatus status={about.status} />
        {about.data &&
          toParagraphs(about.data.body).map((text, i) => (
            <p key={i} className="about__text">
              {text}
            </p>
          ))}

        {/* Arrows sit beside the photo (hidden on touch screens, which swipe).
            The billboard wrapper lifts and tilts the frame on hover; the frame
            itself plays the entrance effect. */}
        <div className="dojo-gallery" data-visible={photoInView}>
          {count > 1 && (
            <ArrowButton direction={-1} label={t.about.previousPhoto} className="scroll-button dojo-gallery__arrow" onStep={(d) => step(carousel, d)} />
          )}
          <div ref={billboardRef} className="billboard">
            <div
              ref={photoRef}
              className="about__photo-frame carousel"
              role="region"
              aria-label={t.about.photos}
              data-effect={PHOTO_EFFECT}
              data-visible={photoInView}
            >
              <ul ref={trackRef} className="carousel__track">
                {photos?.map((photo, i) => (
                  <li key={photo.id} className="carousel__slide">
                    <button
                      type="button"
                      className="carousel__open"
                      aria-haspopup="dialog"
                      onClick={() => openViewer(i)}
                    >
                      <img
                        className="about__photo carousel__img"
                        src={photo.src}
                        alt={photo.alt}
                        loading={i === 0 ? 'eager' : 'lazy'}
                      />
                    </button>
                  </li>
                ))}
              </ul>
              {count > 1 && <PhotoCount index={carousel.index} count={count} />}
            </div>
          </div>
          {count > 1 && (
            <ArrowButton direction={1} label={t.about.nextPhoto} className="scroll-button dojo-gallery__arrow" onStep={(d) => step(carousel, d)} />
          )}
        </div>
      </div>

      <dialog
        ref={viewerRef}
        className="photo-viewer carousel"
        aria-label={t.about.photos}
        onClose={syncFromViewer}
        onKeyDown={onViewerKeyDown}
      >
        <button
          type="button"
          className="photo-viewer__close"
          aria-label={t.about.closePhoto}
          onClick={() => viewerRef.current.close()}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
        <ul ref={viewerTrackRef} className="carousel__track">
          {photos?.map((photo) => (
            <li key={photo.id} className="carousel__slide">
              {/* Lazy, so nothing downloads until the viewer opens. */}
              <img className="photo-viewer__img" src={photo.src} alt={photo.alt} loading="lazy" />
            </li>
          ))}
        </ul>
        {count > 1 && (
          <>
            <ArrowButton direction={-1} label={t.about.previousPhoto} className="carousel__arrow carousel__arrow--prev" onStep={(d) => step(viewer, d)} />
            <ArrowButton direction={1} label={t.about.nextPhoto} className="carousel__arrow carousel__arrow--next" onStep={(d) => step(viewer, d)} />
            <PhotoCount index={viewer.index} count={count} />
          </>
        )}
      </dialog>
    </section>
  );
}

function ArrowButton({ direction, label, className, onStep }) {
  return (
    <button type="button" className={className} aria-label={label} onClick={() => onStep(direction)}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d={direction < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function PhotoCount({ index, count }) {
  return (
    <p className="carousel__count" aria-hidden="true">
      {index + 1} / {count}
    </p>
  );
}
