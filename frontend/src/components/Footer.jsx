import { useLanguage } from '../i18n/LanguageContext.jsx';

export function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container">
        <p>
          © {year} {t.hero.title}. {t.footer.rights}
        </p>
        <p className="site-footer__notice">{t.footer.placeholderNotice}</p>
      </div>
    </footer>
  );
}
