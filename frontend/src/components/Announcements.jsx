import { useLanguage } from '../i18n/LanguageContext.jsx';
import { formatDate } from '../lib/format.js';

export function Announcements({ items }) {
  const { language, t } = useLanguage();

  return (
    <section id="announcements" className="section surface-dark panel" aria-labelledby="announcements-title">
      <h2 id="announcements-title" className="section__title panel__title" tabIndex={-1}>
        {t.sections.announcements}
      </h2>
      <ul className="announcements">
        {items.map((item) => (
          <li key={item.id}>
            <article className="announcement">
              <time className="announcement__date" dateTime={item.date}>
                {formatDate(item.date, language)}
              </time>
              <h3 className="announcement__title">{item.title}</h3>
              <p className="announcement__body">{item.body}</p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
