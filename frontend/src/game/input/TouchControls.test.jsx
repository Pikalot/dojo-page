import { fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { gameStrings } from '../../i18n/game.js';
import { LanguageProvider } from '../../i18n/LanguageContext.jsx';
import { TouchControls } from './TouchControls.jsx';

const t = gameStrings.en.game.touch;

function renderControls(props = {}) {
  const onInput = vi.fn();
  const view = render(
    <LanguageProvider initialLanguage="en" extraStrings={gameStrings}>
      <TouchControls onInput={onInput} toSimTime={(ts) => ts - 100} {...props} />
    </LanguageProvider>,
  );
  return { ...view, onInput };
}

describe('TouchControls', () => {
  it('sends parry and strike on pointer down, stamped with simulation time', () => {
    const { onInput } = renderControls();
    fireEvent.pointerDown(screen.getByRole('button', { name: t.parry }), { pointerId: 1 });
    fireEvent.pointerDown(screen.getByRole('button', { name: t.strike }), { pointerId: 2 });
    expect(onInput.mock.calls.map(([input]) => input.type)).toEqual(['parry', 'strike']);
    for (const [input] of onInput.mock.calls) expect(typeof input.at).toBe('number');
  });

  it('sends parryRelease when the Parry button is let go (hold to block)', () => {
    const { onInput } = renderControls();
    const parry = screen.getByRole('button', { name: t.parry });
    fireEvent.pointerDown(parry, { pointerId: 3 });
    fireEvent.pointerUp(parry, { pointerId: 3 });
    expect(onInput.mock.calls.map(([i]) => i.type)).toEqual(['parry', 'parryRelease']);
  });

  it('moves while a pad button is held and stops on release', () => {
    const { onInput } = renderControls();
    const right = screen.getByRole('button', { name: t.right });
    fireEvent.pointerDown(right, { pointerId: 5 });
    fireEvent.pointerUp(right, { pointerId: 5 });
    expect(onInput.mock.calls.map(([i]) => [i.dx, i.dy])).toEqual([
      [1, 0],
      [0, 0],
    ]);
  });

  it('combines two fingers on the pad', () => {
    const { onInput } = renderControls();
    fireEvent.pointerDown(screen.getByRole('button', { name: t.up }), { pointerId: 1 });
    fireEvent.pointerDown(screen.getByRole('button', { name: t.left }), { pointerId: 2 });
    expect(onInput.mock.calls.at(-1)[0]).toMatchObject({ dx: -1, dy: -1 });
  });

  it('dims Parry and Strike while their cooldowns run', () => {
    renderControls({ parryReady: false, strikeReady: true });
    expect(screen.getByRole('button', { name: t.parry })).toHaveClass('touch__button--cooling');
    expect(screen.getByRole('button', { name: t.strike })).not.toHaveClass('touch__button--cooling');
  });

  it('has no axe violations', async () => {
    const { container } = renderControls();
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
