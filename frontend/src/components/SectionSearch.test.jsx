import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSharedResults } from '../api/shared.js';
import { renderWithLanguage } from '../test/renderWithLanguage.jsx';
import { SectionSearch } from './SectionSearch.jsx';

function renderSearch(options) {
  const onNavigate = vi.fn();
  const utils = renderWithLanguage(
    <>
      <SectionSearch onNavigate={onNavigate} />
      <section id="schedule">
        <h2 tabIndex={-1}>Schedule</h2>
      </section>
      <section id="faq">
        <h2 tabIndex={-1}>FAQ</h2>
      </section>
    </>,
    options,
  );
  return { ...utils, onNavigate, input: screen.getByRole('combobox') };
}

describe('SectionSearch', () => {
  beforeEach(() => clearSharedResults());

  it('shows matching sections as options while typing', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch();

    expect(input).toHaveAttribute('aria-expanded', 'false');
    await user.type(input, 'sched');

    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('option', { name: 'Schedule' })).toBeInTheDocument();
  });

  it('moves through options with arrow keys and jumps on Enter', async () => {
    const user = userEvent.setup();
    const { input, onNavigate } = renderSearch();

    await user.type(input, 'pri'); // "price" keyword -> FAQ
    await user.keyboard('{ArrowDown}');
    const option = screen.getByRole('option', { name: 'FAQ' });
    expect(option).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', option.id);

    await user.keyboard('{Enter}');

    expect(document.getElementById('faq').scrollIntoView).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'FAQ' })).toHaveFocus();
    expect(window.location.hash).toBe('#faq');
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('');
  });

  it('jumps to the top result on Enter without arrowing first', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, 'schedule{Enter}');

    expect(screen.getByRole('heading', { name: 'Schedule' })).toHaveFocus();
  });

  it('selects an option by mouse click', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, 'faq');
    await user.click(await screen.findByRole('option', { name: 'FAQ' }));

    expect(screen.getByRole('heading', { name: 'FAQ' })).toHaveFocus();
  });

  it('closes on Escape, then clears on a second Escape', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, 'faq');
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveValue('faq');

    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
  });

  it('tells the user when nothing matches', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, 'zzzz');

    expect((await screen.findAllByText('No matches')).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('finds sections by Vietnamese words without accents and labels them in Vietnamese', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch({ language: 'vi' });

    await user.type(input, 'hoi dap');

    expect(await screen.findByRole('option', { name: 'Hỏi đáp' })).toBeInTheDocument();
  });

  it('does not filter on every keystroke, and never flashes "no matches" while typing', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, 'sched');

    // The instant after typing: still waiting, so neither a result nor a false "no matches".
    expect(screen.queryByRole('option')).toBeNull();
    expect(screen.queryByText('No matches')).toBeNull();
    expect(await screen.findByRole('option', { name: 'Schedule' })).toBeInTheDocument();
  });

  // Search runs in the browser over a fixed list of sections. If it ever starts
  // calling the backend, this should fail, so that change gets a security review.
  it.each(["' OR 1=1 --", '"; DROP TABLE Contents; --', '<img src=x onerror=alert(1)>'])(
    'never sends what is typed anywhere, and shows it as plain text: %s',
    async (attack) => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const user = userEvent.setup();
      const { input, container } = renderSearch();

      await user.click(input);
      await user.paste(attack);
      await user.keyboard('{Enter}');

      expect(fetchMock).not.toHaveBeenCalled();
      expect(input).toHaveValue(attack);
      expect(container.querySelector('img')).toBeNull();
      vi.unstubAllGlobals();
    },
  );

  it('with the backend on, only ever fetches the fixed list, never what is typed', async () => {
    vi.stubEnv('VITE_USE_API', 'true');
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.click(input);
    await user.paste("' OR 1=1 --");
    await user.keyboard('{Enter}');

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/instructors']);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('makes no request until the box is used, and only one after that', async () => {
    vi.stubEnv('VITE_USE_API', 'true');
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const { input } = renderSearch();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(input);
    await user.tab();
    await user.click(input);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('still searches sections if the instructor list fails, and retries on the next focus', async () => {
    vi.stubEnv('VITE_USE_API', 'true');
    const fetchMock = vi.fn(() => Promise.reject(new TypeError('offline')));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.click(input);
    await user.type(input, 'sched');
    expect(await screen.findByRole('option', { name: 'Schedule' })).toBeInTheDocument();

    await user.tab();
    await user.click(input);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});
