import { render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { gameStrings } from '../../i18n/game.js';
import { LanguageProvider } from '../../i18n/LanguageContext.jsx';
import { Results } from './Results.jsx';

const lost = { outcome: 'lost', throws: 7, perfectParries: 3, combos: 1, enemiesDefeated: 9, score: 1025 };

function renderResults(result = lost, language = 'en') {
  const onPlayAgain = vi.fn();
  const view = render(
    <LanguageProvider initialLanguage={language} extraStrings={gameStrings}>
      <Results result={result} onPlayAgain={onPlayAgain} />
    </LanguageProvider>,
  );
  return { ...view, onPlayAgain };
}

describe('Results', () => {
  it('shows "Good try!" for a loss and moves focus to it', () => {
    renderResults();
    const heading = screen.getByRole('heading', { name: 'Good try!' });
    expect(heading).toHaveFocus();
  });

  it('shows "You win!" for a win', () => {
    renderResults({ ...lost, outcome: 'won' });
    expect(screen.getByRole('heading', { name: 'You win!' })).toBeInTheDocument();
  });

  it('shows throws, perfect parries, enemies defeated and score', () => {
    renderResults();
    for (const [label, value] of [
      ['Throws', '7'],
      ['Perfect parries', '3'],
      ['Troublemakers defeated', '9'],
      ['Score', '1025'],
    ]) {
      expect(screen.getByText(label).nextSibling).toHaveTextContent(value);
    }
  });

  it('starts a new game from Play again and links back to the site', () => {
    const { onPlayAgain } = renderResults();
    screen.getByRole('button', { name: 'Play again' }).click();
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: gameStrings.en.game.backToSite })).toHaveAttribute('href', '/');
  });

  it('has no axe violations in English and Vietnamese', async () => {
    for (const language of ['en', 'vi']) {
      const { container, unmount } = renderResults(lost, language);
      const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
      expect(results.violations, language).toEqual([]);
      unmount();
    }
  });
});
