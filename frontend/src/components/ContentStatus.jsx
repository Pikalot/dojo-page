import { useLanguage } from '../i18n/LanguageContext.jsx';

/** Placeholder shown inside a section while its content loads or if it fails. */
export function ContentStatus({ status }) {
  const { t } = useLanguage();

  if (status === 'loading') {
    return (
      <p className="content-status" aria-busy="true">
        {t.content.loading}
      </p>
    );
  }
  if (status === 'error') {
    return (
      <p className="content-status" role="alert">
        {t.content.error}
      </p>
    );
  }
  return null;
}
