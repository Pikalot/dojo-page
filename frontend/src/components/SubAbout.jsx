import { getAbout, getLocation } from '../api/content.js';
import { useContent } from '../hooks/useContent.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { toLines, toParagraphs } from '../lib/text.js';
import { ContentStatus } from './ContentStatus.jsx';
import { SectionLink } from './SectionLink.jsx';
import './About.css';

// Location is folded into About (per wireframe review); the map lives in Contact.
export function SubAbout() {
  const { t } = useLanguage();
  const about = useContent(getAbout);
  const location = useContent(getLocation);

  return (
    <section id="sub-about" className="section about" aria-labelledby="sub-about-title">
      <div className="container">
        <h2 id="sub-about-title" className="section__title about__title" tabIndex={-1}>
          {t.sections.about}
        </h2>

        <ContentStatus status={about.status} />
        {about.data &&
          toParagraphs(about.data.body).map((text, i) => (
            <p key={i} className="about__text">
              {text}
            </p>
          ))}

        {/* {location.data && (
          <div className="about__location">
            <h3 className="about__subtitle">{t.sections.whereWeTrain}</h3>
            <address className="about__address">
              <strong>{location.data.name}</strong>
              {toLines(location.data.address).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </address>
            <p className="about__text">{location.data.note}</p>
            <SectionLink to="contact" className="about__map-link">
              {t.sections.seeMap}
            </SectionLink>
          </div>
        )} */}
      </div>
    </section>
  );
}
