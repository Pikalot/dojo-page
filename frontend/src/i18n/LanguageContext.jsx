import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LANGUAGE, LANGUAGES, strings } from './strings.js';

const STORAGE_KEY = 'dojo.language';
const SUPPORTED = LANGUAGES.map((l) => l.code);

const LanguageContext = createContext(null);

// Storage can be unavailable (private mode, blocked cookies), so every access is guarded.
function readStoredLanguage() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return SUPPORTED.includes(value) ? value : null;
  } catch {
    return null;
  }
}

function detectInitialLanguage() {
  const stored = readStoredLanguage();
  if (stored) return stored;
  const browser = (typeof navigator !== 'undefined' && navigator.language) || '';
  return browser.toLowerCase().startsWith('vi') ? 'vi' : DEFAULT_LANGUAGE;
}

export function LanguageProvider({ children, initialLanguage }) {
  const [language, setLanguageState] = useState(() => initialLanguage ?? detectInitialLanguage());

  const setLanguage = useCallback((code) => {
    if (!SUPPORTED.includes(code)) return;
    setLanguageState(code);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Remembering the choice is a convenience; ignore storage failures.
    }
  }, []);

  // Keep <html lang> and the tab title in sync so screen readers pronounce
  // text correctly and the title matches the visible language.
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = strings[language].meta.title;
  }, [language]);

  const value = useMemo(
    () => ({ language, setLanguage, t: strings[language] }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return context;
}
