import { useLanguage } from '../i18n/LanguageContext.jsx';
import { SectionLink } from './SectionLink.jsx';
import './About.css';

// Location is folded into About (per wireframe review); the map lives in Contact.
export function About({ about, location }) {
  const { t } = useLanguage();

  return (
    <section id="about" className="section about" aria-labelledby="about-title">
      <div className="about__inner container">
        <h2 id="about-title" className="section__title about__title" tabIndex={-1}>
          {t.sections.about}
        </h2>
        {about.paragraphs.map((text, i) => (
          <p key={i} className="about__text">
            {text}
          </p>
        ))}

        <div className="about__location">
          <h3 className="about__subtitle">{t.sections.whereWeTrain}</h3>
          <address className="about__address">
            <strong>{location.name}</strong>
            {location.addressLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </address>
          <p className="about__text">{location.note}</p>
          <SectionLink to="contact" className="about__map-link">
            {t.sections.seeMap}
          </SectionLink>
        </div>
      </div>
    </section>
  );
}
