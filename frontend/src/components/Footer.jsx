import { useLanguage } from '../i18n/LanguageContext.jsx';

// The editor's address, set at build time (VITE_ADMIN_URL), so it can change
// with the server or domain without a code change. Only web addresses are used.
function adminUrl() {
  const value = (import.meta.env.VITE_ADMIN_URL || '').trim();
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();
  const staffUrl = adminUrl();

  return (
    <footer className="site-footer">
      <div className="container">
        <p>
          © {year} {t.hero.title}. {t.footer.rights}
        </p>
        {t.footer.placeholderNotice && <p className="site-footer__notice">{t.footer.placeholderNotice}</p>}
        {staffUrl && (
          <p className="site-footer__staff">
            <a href={staffUrl}>{t.footer.staffSignIn}</a>
          </p>
        )}
      </div>
    </footer>
  );
}
