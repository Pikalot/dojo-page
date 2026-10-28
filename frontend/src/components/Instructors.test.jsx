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
  const [person] = content.getInstructors;
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
    const [withPhoto, withoutPhoto] = content.getInstructors;

    const photo = await screen.findByRole('img', { name: t.instructors.photoAlt(withPhoto.name) });
    expect(photo).toHaveAttribute('src', withPhoto.photo);
    expect(screen.queryByRole('img', { name: t.instructors.photoAlt(withoutPhoto.name) })).not.toBeInTheDocument();
  });
});
