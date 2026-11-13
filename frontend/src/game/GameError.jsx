import { useLanguage } from '../i18n/LanguageContext.jsx';
import './GameError.css';

/** Shown instead of a blank page when the game can't start or crashes (FR-027). */
export function GameError() {
  const { t } = useLanguage();
  return (
    <main className="game-error surface-dark">
      <h1 className="game-error__title">{t.game.title}</h1>
      <p role="alert">{t.game.error.message}</p>
      <div className="game-error__actions">
        <button type="button" className="button button--primary" onClick={() => window.location.reload()}>
          {t.game.error.reload}
        </button>
        <a className="button button--ghost" href="/">
          {t.game.backToSite}
        </a>
      </div>
    </main>
  );
}
