import { act, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { gameStrings } from '../../i18n/game.js';
import { LanguageProvider } from '../../i18n/LanguageContext.jsx';
import { Hud } from './Hud.jsx';

function renderHud(props = {}, language = 'en') {
  const all = { health: 70, maxHealth: 100, score: 250, soundOn: false, onToggleSound: vi.fn(), ...props };
  const view = render(
    <LanguageProvider initialLanguage={language} extraStrings={gameStrings}>
      <Hud {...all} />
    </LanguageProvider>,
  );
  return { ...view, props: all };
}

describe('Hud', () => {
  it('shows health as a labelled meter and the score', () => {
    renderHud();
    const meter = screen.getByRole('meter', { name: 'Health' });
    expect(meter).toHaveAttribute('aria-valuenow', '70');
    expect(meter).toHaveAttribute('aria-valuemax', '100');
    expect(screen.getByText('250')).toBeInTheDocument();
  });

  it('has a sound toggle that reports its state', () => {
    const { props } = renderHud();
    const button = screen.getByRole('button', { name: /Sound/ });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    button.click();
    expect(props.onToggleSound).toHaveBeenCalledTimes(1);
  });

  it('shows the on-screen buttons toggle only when it can be used', () => {
    const onToggleControls = vi.fn();
    renderHud({ controlsOn: true, onToggleControls });
    const button = screen.getByRole('button', { name: /On-screen buttons/ });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    button.click();
    expect(onToggleControls).toHaveBeenCalledTimes(1);
  });

  it('leaves the toggle out without a handler', () => {
    renderHud();
    expect(screen.queryByRole('button', { name: /On-screen buttons/ })).not.toBeInTheDocument();
  });

  it('shakes the health bar on a hit, but not with reduced motion', () => {
    const { container, rerender, props } = renderHud();
    const wrap = (p) => (
      <LanguageProvider initialLanguage="en" extraStrings={gameStrings}>
        <Hud {...props} {...p} />
      </LanguageProvider>
    );
    act(() => rerender(wrap({ hitCount: 1 })));
    expect(container.querySelector('.hud__health--shake')).not.toBeNull();

    const calm = renderHud({ hitCount: 1, reducedMotion: true });
    expect(calm.container.querySelector('.hud__health--shake')).toBeNull();
  });

  it('has no axe violations in English and Vietnamese', async () => {
    for (const language of ['en', 'vi']) {
      const { container, unmount } = renderHud({}, language);
      const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
      expect(results.violations, language).toEqual([]);
      unmount();
    }
  });
});
