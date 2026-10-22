import { getContact, getLocation } from '../api/content.js';
import { useContent } from '../hooks/useContent.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { toLines, toParagraphs } from '../lib/text.js';
import { ContentStatus } from './ContentStatus.jsx';

// The map and directions are built from the address the editor typed,
// so it only has to be entered once.
const mapsEmbedUrl = (query) =>
  `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
const mapsDirectionsUrl = (query) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;

export function Contact() {
  const { t } = useLanguage();
  const contact = useContent(getContact);
  const location = useContent(getLocation);
  const addressLines = location.data ? toLines(location.data.address) : [];
  const mapQuery = addressLines.join(', ');

  return (
    <section id="contact" className="section surface-blue panel" aria-labelledby="contact-title">
      <h2 id="contact-title" className="section__title panel__title" tabIndex={-1}>
        {t.sections.contact}
      </h2>
      <ContentStatus status={contact.status} />
      {contact.data && (
        <>
          {toParagraphs(contact.data.intro).map((text, i) => (
            <p key={i}>{text}</p>
          ))}

          <dl className="contact-details">
            {location.data && (
              <div>
                <dt>{t.contact.address}</dt>
                <dd>
                  <address>
                    {addressLines.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </address>
                </dd>
              </div>
            )}
            <div>
              <dt>{t.contact.phone}</dt>
              <dd>
                <a href={`tel:${contact.data.phone.replace(/[^\d+]/g, '')}`}>{contact.data.phone}</a>
              </dd>
            </div>
            <div>
              <dt>{t.contact.email}</dt>
              <dd>
                <a href={`mailto:${contact.data.email}`}>{contact.data.email}</a>
              </dd>
            </div>
          </dl>
        </>
      )}

      {location.data && (
        <>
          {/* The embed loads only when scrolled near, so Google is not contacted on first paint. */}
          <div className="map-frame">
            <iframe
              title={t.contact.mapTitle}
              src={mapsEmbedUrl(mapQuery)}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>

          {/* Block wrapper so the button follows the panel's centered reading width. */}
          <p>
            <a
              className="button button--light"
              href={mapsDirectionsUrl(mapQuery)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.contact.directions}
              <span className="visually-hidden"> {t.contact.newTab}</span>
            </a>
          </p>
        </>
      )}
    </section>
  );
}
