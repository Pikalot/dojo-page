import { useLanguage } from '../i18n/LanguageContext.jsx';

const mapsEmbedUrl = (query) =>
  `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
const mapsDirectionsUrl = (query) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;

export function Contact({ contact, location }) {
  const { t } = useLanguage();

  return (
    <section id="contact" className="section surface-blue panel" aria-labelledby="contact-title">
      <h2 id="contact-title" className="section__title panel__title" tabIndex={-1}>
        {t.sections.contact}
      </h2>
      <p>{contact.intro}</p>

      <dl className="contact-details">
        <div>
          <dt>{t.contact.address}</dt>
          <dd>
            <address>
              {location.addressLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </address>
          </dd>
        </div>
        <div>
          <dt>{t.contact.phone}</dt>
          <dd>
            <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}>{contact.phone}</a>
          </dd>
        </div>
        <div>
          <dt>{t.contact.email}</dt>
          <dd>
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
          </dd>
        </div>
      </dl>

      {/* The embed loads only when scrolled near, so Google is not contacted on first paint. */}
      <div className="map-frame">
        <iframe
          title={t.contact.mapTitle}
          src={mapsEmbedUrl(location.mapQuery)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>

      <a
        className="button button--light"
        href={mapsDirectionsUrl(location.mapQuery)}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t.contact.directions}
        <span className="visually-hidden"> {t.contact.newTab}</span>
      </a>
    </section>
  );
}
