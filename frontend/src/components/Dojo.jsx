import { useRef } from 'react';
import { getAbout } from '../api/content.js';
import { useContent } from '../hooks/useContent.js';
import { useInView } from '../hooks/useInView.js';
import { useTilt } from '../hooks/useTilt.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { toParagraphs } from '../lib/text.js';
import { ContentStatus } from './ContentStatus.jsx';
import './About.css';
import dojo_pic from '../assets/dojo.jpg';

// Photo entrance effect: 'zoom' (zoom settle) or 'wipe' (center-out reveal).
// Styles for each are in About.css.
const PHOTO_EFFECT = 'wipe';

export function Dojo() {
  const { t } = useLanguage();
  const about = useContent(getAbout);
  const photoRef = useRef(null);
  const photoInView = useInView(photoRef);
  const billboardRef = useRef(null);
  useTilt(billboardRef);

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
        
        {/* The billboard wrapper lifts and tilts the frame on hover; the frame
            itself plays the entrance effect. */}
        <div ref={billboardRef} className="billboard">
          <div
            ref={photoRef}
            className="about__photo-frame"
            data-effect={PHOTO_EFFECT}
            data-visible={photoInView}
          >
            <img className="about__photo" src={dojo_pic} alt={t.about.photoAlt} />
          </div>
        </div>
      </div>
    </section>
  );
}
