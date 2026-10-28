import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithLanguage } from '../test/renderWithLanguage.jsx';
import { Navbar } from './Navbar.jsx';

function renderNavbar() {
  renderWithLanguage(
    <>
      <Navbar />
      <section id="schedule">
        <h2 tabIndex={-1}>Schedule</h2>
      </section>
    </>,
  );
  return {
    menuButton: screen.getByRole('button', { name: 'Open menu' }),
    nav: screen.getByRole('navigation', { name: 'Main' }),
  };
}

describe('Navbar', () => {
  it('links to every section', () => {
    const { nav } = renderNavbar();
    const labels = within(nav).getAllByRole('link').map((a) => a.textContent);
    expect(labels).toEqual(['About', 'Announcements', 'Schedule', 'Instructors', 'Contact', 'FAQ']);
  });

  it('toggles the menu and reflects state in aria-expanded', async () => {
    const user = userEvent.setup();
    const { menuButton, nav } = renderNavbar();

    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton).toHaveAttribute('aria-controls', nav.id);

    await user.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(menuButton).toHaveAccessibleName('Close menu');
    expect(nav).toHaveAttribute('data-open', 'true');
  });

  it('closes on Escape and returns focus to the menu button', async () => {
    const user = userEvent.setup();
    const { menuButton } = renderNavbar();

    await user.click(menuButton);
    await user.tab(); // into the menu
    await user.keyboard('{Escape}');

    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton).toHaveFocus();
  });

  it('closes the menu and focuses the section heading after a link is chosen', async () => {
    const user = userEvent.setup();
    const { menuButton, nav } = renderNavbar();

    await user.click(menuButton);
    await user.click(within(nav).getByRole('link', { name: 'Schedule' }));

    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('heading', { name: 'Schedule' })).toHaveFocus();
  });

  it('switches language from the menu', async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByRole('button', { name: /Tiếng Việt/ }));

    expect(screen.getByRole('button', { name: /Tiếng Việt/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: 'Lịch tập' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('vi');
    expect(window.localStorage.getItem('dojo.language')).toBe('vi');
  });
});
