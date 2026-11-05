import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../api/content.js';
import { strings } from '../i18n/strings.js';
import { makeContent, serveContent } from '../test/content.js';
import { renderWithLanguage } from '../test/renderWithLanguage.jsx';
import { Instructors } from './Instructors.jsx';

vi.mock('../api/content.js');

const t = strings.en;
let content;

beforeEach(() => {
  content = makeContent();
  serveContent(api, content);

  // jsdom has <dialog> but not showModal(); mimic what the browser does.
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});

async function openFirstProfile() {
  const user = userEvent.setup();
  renderWithLanguage(<Instructors />);
  const [person] = content.getInstructors.instructors;
  await user.click(await screen.findByRole('button', { name: person.name }));
  return { user, person };
}

describe('Instructors', () => {
  it('opens a profile modal for the instructor whose card was clicked', async () => {
    const { person } = await openFirstProfile();

    const modal = screen.getByRole('dialog', { name: person.name });
    expect(modal).toHaveAttribute('open');
    expect(within(modal).getByRole('heading', { name: person.name })).toBeInTheDocument();
  });

  it('closes the modal with its close button', async () => {
    const { user, person } = await openFirstProfile();

    await user.click(screen.getByRole('button', { name: t.instructors.close }));

    expect(screen.queryByRole('dialog', { name: person.name })).not.toBeInTheDocument();
  });

  it("shows an instructor's photo, or the dojo logo when there is none", async () => {
    renderWithLanguage(<Instructors />);
    const [withPhoto, withoutPhoto] = content.getInstructors.instructors;

    const photo = await screen.findByRole('img', { name: t.instructors.photoAlt(withPhoto.name) });
    expect(photo).toHaveAttribute('src', withPhoto.photo);
    expect(screen.queryByRole('img', { name: t.instructors.photoAlt(withoutPhoto.name) })).not.toBeInTheDocument();
  });

  it('lists black belts by name instead of on instructor cards', async () => {
    renderWithLanguage(<Instructors />);
    const names = content.getInstructors.blackBelts.flatMap(({ members }) => members.map(({ name }) => name));

    const list = (await screen.findByRole('heading', { name: t.instructors.blackBelts })).parentElement;
    for (const name of names) {
      expect(within(list).getByText(name)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('opens a profile when the search box asks for one', async () => {
    const { openInstructorProfile } = await import('../lib/instructorProfile.js');
    const { act } = await import('@testing-library/react');
    renderWithLanguage(<Instructors />);
    const person = content.getInstructors.instructors[0];
    await screen.findByRole('button', { name: person.name });

    act(() => openInstructorProfile(person.id));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: person.name })).toBeInTheDocument();
  });

  it('ignores a request for someone who is not on the page', async () => {
    const { openInstructorProfile } = await import('../lib/instructorProfile.js');
    const { act } = await import('@testing-library/react');
    renderWithLanguage(<Instructors />);
    await screen.findByRole('button', { name: content.getInstructors.instructors[0].name });

    act(() => openInstructorProfile('nobody'));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('highlights and focuses a black belt on request, then lets go', async () => {
    const { highlightBlackBelt } = await import('../lib/instructorProfile.js');
    const { act } = await import('@testing-library/react');
    renderWithLanguage(<Instructors />);
    const member = content.getInstructors.blackBelts[0].members[0];
    const name = await screen.findByText(member.name);
    expect(name).not.toHaveAttribute('data-highlighted');

    vi.useFakeTimers();
    try {
      act(() => highlightBlackBelt(member.id));
      expect(name).toHaveAttribute('data-highlighted');
      expect(name).toHaveFocus();

      // Choosing them again restarts the time.
      act(() => vi.advanceTimersByTime(2000));
      act(() => highlightBlackBelt(member.id));
      act(() => vi.advanceTimersByTime(2000));
      expect(name).toHaveAttribute('data-highlighted');

      act(() => vi.advanceTimersByTime(1000));
      expect(name).not.toHaveAttribute('data-highlighted');
    } finally {
      vi.useRealTimers();
    }
  });

  it('highlights only the requested person', async () => {
    const { highlightBlackBelt } = await import('../lib/instructorProfile.js');
    const { act } = await import('@testing-library/react');
    renderWithLanguage(<Instructors />);
    const [first, second] = content.getInstructors.blackBelts.flatMap((group) => group.members);
    await screen.findByText(first.name);

    act(() => highlightBlackBelt(first.id));

    expect(screen.getByText(first.name)).toHaveAttribute('data-highlighted');
    expect(screen.getByText(second.name)).not.toHaveAttribute('data-highlighted');
  });
});
