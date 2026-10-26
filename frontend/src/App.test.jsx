import { screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from './api/content.js';
import { App } from './App.jsx';
import { strings } from './i18n/strings.js';
import { SECTIONS } from './sections.js';
import { makeContent, serveContent } from './test/content.js';
import { renderWithLanguage } from './test/renderWithLanguage.jsx';

// Sections load test-owned content, so no test depends on what the real content says.
vi.mock('./api/content.js');

const t = strings.en;
const section = (id) => within(document.getElementById(id));

beforeEach(() => {
  serveContent(api, makeContent());
});

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

  // Checks structure and load state only, never content: the section must appear
  // once and finish loading without an error.
  it.each(SECTIONS.map(({ id }) => id))('renders the %s section once and finishes loading', async (id) => {
    renderWithLanguage(<App />);

    expect(document.querySelectorAll(`[id="${id}"]`), `#${id} on the page`).toHaveLength(1);
    expect(section(id).getAllByRole('heading').length).toBeGreaterThan(0);

    await waitFor(() => expect(section(id).queryByText(t.content.loading)).not.toBeInTheDocument());
    expect(section(id).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a loading message in a section until its content arrives', () => {
    api.getSchedule.mockReturnValue(new Promise(() => {}));
    renderWithLanguage(<App />);
    expect(section('schedule').getByText(t.content.loading)).toBeInTheDocument();
  });

  it('shows an error in a section that fails to load, without breaking the others', async () => {
    api.getSchedule.mockRejectedValue(new Error('offline'));
    renderWithLanguage(<App />);

    expect(await section('schedule').findByRole('alert')).toHaveTextContent(t.content.error);
    expect(section('schedule').queryByRole('table')).not.toBeInTheDocument();
    expect(section('fees').queryByText(t.content.loading)).not.toBeInTheDocument();
    expect(section('fees').queryByRole('alert')).not.toBeInTheDocument();
  });

  it('has a skip link that targets the main landmark', () => {
    renderWithLanguage(<App />);
    const skip = screen.getByRole('link', { name: t.nav.skipToContent });
    expect(skip).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it.each(['en', 'vi'])('has no detectable accessibility violations (%s)', async (language) => {
    const { container } = renderWithLanguage(<App />, { language });
    await screen.findAllByRole('table'); // wait for section content to load
    expect(await axeViolations(container)).toEqual([]);
  });

  it('marks the external directions link as opening a new tab', async () => {
    renderWithLanguage(<App />);
    const link = await screen.findByRole('link', { name: (name) => name.startsWith(t.contact.directions) });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAccessibleName(expect.stringContaining(t.contact.newTab));
  });
});
