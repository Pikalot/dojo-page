import { render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { gameStrings } from '../i18n/game.js';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { GameApp } from './GameApp.jsx';

const t = gameStrings.en.game;

function renderGame(language = 'en') {
  return render(
    <LanguageProvider initialLanguage={language} extraStrings={gameStrings} titleKey="game.meta.title">
      <GameApp />
    </LanguageProvider>,
  );
}

describe('GameApp start screen: choosing an aikidoka (FR-019a)', () => {
  it('offers male and female, male by default', () => {
    renderGame();
    const group = screen.getByRole('group', { name: t.character.legend });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: t.character.male })).toBeChecked();
    expect(screen.getByRole('radio', { name: t.character.female })).not.toBeChecked();
  });

  it('remembers the choice on this device', () => {
    const { unmount } = renderGame();
    screen.getByRole('radio', { name: t.character.female }).click();
    expect(window.localStorage.getItem('dojo.game.character')).toBe('female');
    unmount();
    renderGame();
    expect(screen.getByRole('radio', { name: t.character.female })).toBeChecked();
  });

  it('ignores an unknown stored value', () => {
    window.localStorage.setItem('dojo.game.character', 'robot');
    renderGame();
    expect(screen.getByRole('radio', { name: t.character.male })).toBeChecked();
  });

  it('has no axe violations in English and Vietnamese', async () => {
    for (const language of ['en', 'vi']) {
      const { container, unmount } = renderGame(language);
      const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
      expect(results.violations, language).toEqual([]);
      unmount();
    }
  });
});
