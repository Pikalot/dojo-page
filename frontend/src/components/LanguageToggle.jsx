import { useLanguage } from '../i18n/LanguageContext.jsx';
import { LANGUAGES } from '../i18n/strings.js';
import './LanguageToggle.css';

export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="language-toggle" role="group" aria-label={t.nav.language}>
      {LANGUAGES.map(({ code, label, name }) => (
        <button
          key={code}
          type="button"
          className="language-toggle__button"
          aria-pressed={language === code}
          lang={code}
          onClick={() => setLanguage(code)}
        >
          {/* Accessible name starts with the visible label (WCAG 2.5.3) so voice
              users can say "click VI", then adds the full language name. */}
          {label}
          <span className="visually-hidden"> {name}</span>
        </button>
      ))}
    </div>
  );
}
