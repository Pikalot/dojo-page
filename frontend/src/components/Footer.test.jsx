import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithLanguage } from '../test/renderWithLanguage.jsx';
import { Footer } from './Footer.jsx';

describe('Footer staff link', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('links to the editor at the address set for this build', () => {
    vi.stubEnv('VITE_ADMIN_URL', 'https://tenshinkai.duckdns.org/admin/');
    renderWithLanguage(<Footer />);

    expect(screen.getByRole('link', { name: 'Staff sign-in' })).toHaveAttribute(
      'href',
      'https://tenshinkai.duckdns.org/admin/',
    );
  });

  it('is labelled in Vietnamese on the Vietnamese site', () => {
    vi.stubEnv('VITE_ADMIN_URL', 'https://tenshinkai.duckdns.org/admin/');
    renderWithLanguage(<Footer />, { language: 'vi' });

    expect(screen.getByRole('link', { name: 'Đăng nhập dành cho nhân viên' })).toBeInTheDocument();
  });

  it('shows no link when no address is set', () => {
    vi.stubEnv('VITE_ADMIN_URL', '');
    renderWithLanguage(<Footer />);

    expect(screen.queryByRole('link')).toBeNull();
  });

  it.each(['javascript:alert(1)', 'not a url', 'ftp://example.com/admin/'])(
    'ignores an address that is not a web page: %s',
    (value) => {
      vi.stubEnv('VITE_ADMIN_URL', value);
      renderWithLanguage(<Footer />);

      expect(screen.queryByRole('link')).toBeNull();
    },
  );
});
