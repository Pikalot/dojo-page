import { getAbout } from '../api/content.js';
import { useContent } from '../hooks/useContent.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { toParagraphs } from '../lib/text.js';
import { ContentStatus } from './ContentStatus.jsx';
import './About.css';
import dojo_pic from '../assets/dojo.jpg';

export function Dojo() {
  const { t } = useLanguage();
  const about = useContent(getAbout);

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
        
        <img src={dojo_pic} alt={t.about.photoAlt} />
      </div>
    </section>
  );
}
