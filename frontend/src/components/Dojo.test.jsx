import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../api/content.js';
import { strings } from '../i18n/strings.js';
import { makeContent, serveContent } from '../test/content.js';
import { renderWithLanguage } from '../test/renderWithLanguage.jsx';
import { Dojo } from './Dojo.jsx';

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

async function openFirstPhoto() {
  const user = userEvent.setup();
  renderWithLanguage(<Dojo />);
  const [photo] = content.getDojoPhotos;
  await user.click(await screen.findByRole('button', { name: photo.alt.en }));
  return { user };
}

describe('Dojo photos', () => {
  it('opens the fullscreen viewer when a photo is clicked', async () => {
    await openFirstPhoto();
    expect(screen.getByRole('dialog', { name: t.about.photos })).toHaveAttribute('open');
  });

  it('closes the viewer with its close button', async () => {
    const { user } = await openFirstPhoto();
    await user.click(screen.getByRole('button', { name: t.about.closePhoto }));
    expect(screen.queryByRole('dialog', { name: t.about.photos })).not.toBeInTheDocument();
  });
});
