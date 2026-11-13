import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageProvider, useLanguage } from './LanguageContext.jsx';
import { strings } from './strings.js';

function Probe() {
  const { t } = useLanguage();
  return (
    <>
      <p data-testid="extra">{t.extra?.hello ?? 'none'}</p>
      <p data-testid="shared">{t.meta.title}</p>
    </>
  );
}

const extraStrings = {
  en: { extra: { hello: 'Hello' }, meta: { pageTitle: 'Page title' } },
  vi: { extra: { hello: 'Xin chào' }, meta: { pageTitle: 'Tiêu đề trang' } },
};

describe('LanguageProvider', () => {
  it('works unchanged without the optional props', () => {
    render(
      <LanguageProvider initialLanguage="en">
        <Probe />
      </LanguageProvider>,
    );
    expect(screen.getByTestId('extra')).toHaveTextContent('none');
    expect(document.title).toBe(strings.en.meta.title);
  });

  it('merges extraStrings for the current language without losing shared strings', () => {
    render(
      <LanguageProvider initialLanguage="vi" extraStrings={extraStrings}>
        <Probe />
      </LanguageProvider>,
    );
    expect(screen.getByTestId('extra')).toHaveTextContent('Xin chào');
    expect(screen.getByTestId('shared')).toHaveTextContent(strings.vi.meta.title);
  });

  it('uses titleKey for the tab title', () => {
    render(
      <LanguageProvider initialLanguage="en" extraStrings={extraStrings} titleKey="meta.pageTitle">
        <Probe />
      </LanguageProvider>,
    );
    expect(document.title).toBe('Page title');
  });

  it('falls back to the site title when titleKey is missing', () => {
    render(
      <LanguageProvider initialLanguage="en" titleKey="nothing.here">
        <Probe />
      </LanguageProvider>,
    );
    expect(document.title).toBe(strings.en.meta.title);
  });
});
