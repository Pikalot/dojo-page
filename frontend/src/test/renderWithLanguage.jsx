import { render } from '@testing-library/react';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';

export function renderWithLanguage(ui, { language = 'en' } = {}) {
  return render(<LanguageProvider initialLanguage={language}>{ui}</LanguageProvider>);
}
