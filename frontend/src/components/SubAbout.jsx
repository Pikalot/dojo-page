import { getSubcontent, getLocation } from '../api/content.js';
import { useContent } from '../hooks/useContent.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { toParagraphs } from '../lib/text.js';
import { ContentStatus } from './ContentStatus.jsx';
import './About.css';

// Location is folded into About (per wireframe review); the map lives in Contact.
export function SubAbout() {
  const { t } = useLanguage();
  const content = useContent(getSubcontent);
  // The title is optional; an empty heading would be announced as a blank one.
  const title = t.sections.subcontent;

  return (
    <section id="sub-about" className="section about" aria-labelledby={title ? 'sub-about-title' : undefined}>
      <div className="container">
        {title && (
          <h2 id="sub-about-title" className="section__title about__title" tabIndex={-1}>
            {title}
          </h2>
        )}

        <ContentStatus status={content.status} />
        {content.data &&
          toParagraphs(content.data.body).map((text, i) => (
            <p key={i} className="about__text">
              {text}
            </p>
          ))}
      </div>
    </section>
  );
}
