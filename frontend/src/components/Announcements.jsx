import { useRef } from 'react';
import { getAnnouncements } from '../api/content.js';
import { useContent } from '../hooks/useContent.js';
import { useInView } from '../hooks/useInView.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { formatDate } from '../lib/format.js';
import { toParagraphs } from '../lib/text.js';
import { ContentStatus } from './ContentStatus.jsx';

export function Announcements() {
  const { language, t } = useLanguage();
  const { status, data: items } = useContent(getAnnouncements);
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, 0.1);

  return (
    <section
      ref={sectionRef}
      id="announcements"
      className="section surface-dark panel reveal"
      aria-labelledby="announcements-title"
      data-visible={inView}
      style={{ '--reveal-index': 0 }}
    >
      <h2 id="announcements-title" className="section__title panel__title" tabIndex={-1}>
        {t.sections.announcements}
      </h2>
      <ContentStatus status={status} />
      {items && (
        <ul className="announcements">
          {items.map((item) => (
            <li key={item.id}>
              <article className="announcement">
                <time className="announcement__date" dateTime={item.date}>
                  {formatDate(item.date, language)}
                </time>
                <h3 className="announcement__title">{item.title}</h3>
                {toParagraphs(item.body).map((text, i) => (
                  <p key={i} className="announcement__body">
                    {text}
                  </p>
                ))}
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
