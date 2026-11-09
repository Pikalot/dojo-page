import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../api/content.js';
import { onBlackBeltHighlightRequest, onInstructorProfileRequest } from '../lib/instructorProfile.js';
import { renderWithLanguage } from '../test/renderWithLanguage.jsx';
import { SectionSearch } from './SectionSearch.jsx';

vi.mock('../api/content.js');

const data = {
  instructors: [{ id: 'card-1', name: 'Ann Card', rank: { en: 'Godan', vi: 'Ngũ Đẳng' } }],
  blackBelts: [{ rank: { en: 'Shodan', vi: 'Nhất Đẳng' }, members: [{ id: 'list-1', name: 'Bob List' }] }],
};

function renderSearch(options) {
  const onNavigate = vi.fn();
  renderWithLanguage(
    <>
      <SectionSearch onNavigate={onNavigate} />
      <section id="instructors">
        <h2 tabIndex={-1}>Instructors</h2>
        <div id="black-belts">
          <h2 tabIndex={-1}>Black Belts</h2>
        </div>
      </section>
    </>,
    options,
  );
  return { onNavigate, input: screen.getByRole('combobox') };
}

describe('SectionSearch with people', () => {
  let requested;
  let highlighted;
  let stopListening;
  let stopHighlight;

  beforeEach(() => {
    api.getInstructors.mockResolvedValue(data);
    Element.prototype.scrollIntoView = vi.fn();
    requested = vi.fn();
    stopListening?.();
    stopListening = onInstructorProfileRequest(requested);
    highlighted = vi.fn();
    stopHighlight?.();
    stopHighlight = onBlackBeltHighlightRequest(highlighted);
  });

  it('shows a person with their rank in the current language', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch({ language: 'vi' });
    await user.type(input, 'ann');
    expect(await screen.findByRole('option', { name: 'Ann Card Ngũ Đẳng' })).toBeInTheDocument();
  });

  it('choosing someone with a card asks for their profile', async () => {
    const user = userEvent.setup();
    const { input, onNavigate } = renderSearch();
    await user.type(input, 'ann');
    await user.click(await screen.findByRole('option', { name: /Ann Card/ }));

    expect(requested).toHaveBeenCalledWith('card-1');
    expect(highlighted).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Instructors' })).toHaveFocus();
    expect(onNavigate).toHaveBeenCalled();
    expect(input).toHaveValue('');
  });

  it('choosing a black belt asks for a highlight and no profile, and leaves scrolling to the list', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch();
    await user.type(input, 'shodan');
    await user.click(await screen.findByRole('option', { name: /Bob List/ }));

    expect(requested).not.toHaveBeenCalled();
    expect(highlighted).toHaveBeenCalledWith('list-1');
    expect(document.getElementById('black-belts').scrollIntoView).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#black-belts');
  });

  it('Enter right after typing uses what was typed, without waiting for the list', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch();
    await user.click(input);
    await screen.findByRole('combobox');
    await act(async () => {});
    await user.type(input, 'ann{Enter}');
    expect(requested).toHaveBeenCalledWith('card-1');
  });

  it('Enter chooses the first result', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch();
    await user.type(input, 'ann');
    await screen.findByRole('option', { name: /Ann Card/ });
    await user.keyboard('{Enter}');
    expect(requested).toHaveBeenCalledWith('card-1');
  });

  it('escapes HTML in names', async () => {
    api.getInstructors.mockResolvedValue({
      instructors: [{ id: 'x', name: '<img src=x onerror=alert(1)>', rank: { en: 'Godan', vi: 'v' } }],
    });
    const user = userEvent.setup();
    const { input } = renderSearch();
    await user.type(input, 'godan');
    const option = await screen.findByRole('option');
    expect(option).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(option.querySelector('img')).toBeNull();
  });
});
