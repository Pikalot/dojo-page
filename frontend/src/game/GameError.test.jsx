import { act, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import { gameStrings } from '../i18n/game.js';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { GameApp } from './GameApp.jsx';
import { GameError } from './GameError.jsx';

function renderGame(ui, language = 'en') {
  return render(
    <LanguageProvider initialLanguage={language} extraStrings={gameStrings} titleKey="game.meta.title">
      {ui}
    </LanguageProvider>,
  );
}

function Boom() {
  throw new Error('crash');
}

afterEach(() => vi.restoreAllMocks());

describe('GameError', () => {
  it('replaces a crashed game with the friendly message and a way back', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderGame(
      <ErrorBoundary fallback={<GameError />}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(gameStrings.en.game.error.message);
    expect(screen.getByRole('button', { name: gameStrings.en.game.error.reload })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: gameStrings.en.game.backToSite })).toHaveAttribute('href', '/');
  });

  it('shows the message when the browser cannot draw on a canvas', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    renderGame(<GameApp />, 'vi');
    await act(async () => {
      screen.getByRole('button', { name: gameStrings.vi.game.start }).click();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(gameStrings.vi.game.error.message);
  });

  it('keeps the site default when no fallback is given', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderGame(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.queryByText(gameStrings.en.game.error.message)).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = renderGame(<GameError />);
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
