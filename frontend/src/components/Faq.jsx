import { getFaq } from '../api/content.js';
import { useContent } from '../hooks/useContent.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { toParagraphs } from '../lib/text.js';
import { ContentStatus } from './ContentStatus.jsx';

/**
 * Frequently asked questions as native <details> disclosures: the browser
 * handles opening, closing, keyboard and screen-reader support.
 */
export function Faq() {
  const { t } = useLanguage();
  const { status, data: items } = useContent(getFaq);

  return (
    <section id="faq" className="section surface-blue panel" aria-labelledby="faq-title">
      <h2 id="faq-title" className="section__title panel__title" tabIndex={-1}>
        {t.sections.faq}
      </h2>
      <ContentStatus status={status} />
      {items && (
        <ul className="faq">
          {items.map((item) => (
            <li key={item.id}>
              <details className="faq__item">
                <summary className="faq__question">{item.question}</summary>
                {toParagraphs(item.answer).map((text, i) => (
                  <p key={i} className="faq__answer">
                    {text}
                  </p>
                ))}
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
