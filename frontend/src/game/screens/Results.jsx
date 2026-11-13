import { useEffect, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import './Results.css';

/**
 * End of the game (FR-017, FR-018): the outcome, the player's stats and Play again.
 * Focus moves to the heading so keyboard and screen reader users land on the outcome.
 */
export function Results({ result, onPlayAgain }) {
  const { t } = useLanguage();
  const heading = useRef(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const rows = [
    ['throws', result.throws],
    ['perfectParries', result.perfectParries],
    ['enemiesDefeated', result.enemiesDefeated],
    ['score', result.score],
  ];

  return (
    <section className="results game__overlay" aria-labelledby="results-heading">
      <h1 id="results-heading" className="game__title" ref={heading} tabIndex={-1}>
        {result.outcome === 'won' ? t.game.results.won : t.game.results.lost}
      </h1>
      <dl className="results__stats">
        {rows.map(([key, value]) => (
          <div key={key} className={`results__row results__row--${key}`}>
            <dt>{t.game.results[key]}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="results__actions">
        <button type="button" className="button button--primary" onClick={onPlayAgain}>
          {t.game.results.playAgain}
        </button>
        <a className="button button--ghost" href="/">
          {t.game.backToSite}
        </a>
      </div>
    </section>
  );
}
