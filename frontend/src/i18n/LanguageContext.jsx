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

// Merges page-only strings into the shared ones, one level deep per top-level key,
// so a page (like the game) can add its own text without the home page loading it.
function mergeStrings(base, extra) {
  if (!extra) return base;
  const merged = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    merged[key] =
      value && typeof value === 'object' && base[key] && typeof base[key] === 'object'
        ? { ...base[key], ...value }
        : value;
  }
  return merged;
}

function readPath(obj, path) {
  return path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), obj);
}

export function LanguageProvider({
  children,
  initialLanguage,
  extraStrings,
  titleKey = 'meta.title',
}) {
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
  const t = useMemo(
    () => mergeStrings(strings[language], extraStrings?.[language]),
    [language, extraStrings],
  );

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = readPath(t, titleKey) ?? strings[language].meta.title;
  }, [language, t, titleKey]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return context;
}
