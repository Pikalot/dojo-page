import { screen } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { App } from './App.jsx';
import { SECTIONS } from './sections.js';
import { renderWithLanguage } from './test/renderWithLanguage.jsx';

async function axeViolations(container) {
  // Color contrast needs real layout, and jsdom cannot enter the third-party map
  // iframe; both are covered by the Playwright suite in a real browser.
  const results = await axe.run(container, {
    iframes: false,
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`);
}

describe('App', () => {
  it('renders one h1 and a heading-labelled region for every section', () => {
    renderWithLanguage(<App />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    for (const { id } of SECTIONS) {
      const section = document.getElementById(id);
      expect(section, `section #${id}`).not.toBeNull();
      expect(section.querySelector('h2')).not.toBeNull();
    }
  });

  it('has a skip link that targets the main landmark', () => {
    renderWithLanguage(<App />);
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it.each(['en', 'vi'])('has no detectable accessibility violations (%s)', async (language) => {
    const { container } = renderWithLanguage(<App />, { language });
    expect(await axeViolations(container)).toEqual([]);
  });

  it('marks the external directions link as opening a new tab', () => {
    renderWithLanguage(<App />);
    const link = screen.getByRole('link', { name: /get directions/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAccessibleName(/opens in a new tab/);
  });
});
