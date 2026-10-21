import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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
      <section id="fees">
        <h2 tabIndex={-1}>Fees</h2>
      </section>
    </>,
    options,
  );
  return { ...utils, onNavigate, input: screen.getByRole('combobox') };
}

describe('SectionSearch', () => {
  it('shows matching sections as options while typing', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch();

    expect(input).toHaveAttribute('aria-expanded', 'false');
    await user.type(input, 'sched');

    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('option', { name: 'Schedule' })).toBeInTheDocument();
  });

  it('moves through options with arrow keys and jumps on Enter', async () => {
    const user = userEvent.setup();
    const { input, onNavigate } = renderSearch();

    await user.type(input, 'pri'); // "price" keyword -> Fees
    await user.keyboard('{ArrowDown}');
    const option = screen.getByRole('option', { name: 'Fees' });
    expect(option).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', option.id);

    await user.keyboard('{Enter}');

    expect(document.getElementById('fees').scrollIntoView).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Fees' })).toHaveFocus();
    expect(window.location.hash).toBe('#fees');
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

    await user.type(input, 'fee');
    await user.click(screen.getByRole('option', { name: 'Fees' }));

    expect(screen.getByRole('heading', { name: 'Fees' })).toHaveFocus();
  });

  it('closes on Escape, then clears on a second Escape', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, 'fee');
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveValue('fee');

    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
  });

  it('tells the user when nothing matches', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, 'zzzz');

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getAllByText('No matching sections').length).toBeGreaterThan(0);
  });

  it('finds sections by Vietnamese words without accents and labels them in Vietnamese', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch({ language: 'vi' });

    await user.type(input, 'hoc phi');

    expect(screen.getByRole('option', { name: 'Học phí' })).toBeInTheDocument();
  });
});
