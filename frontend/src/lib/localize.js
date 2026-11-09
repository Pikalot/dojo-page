function isTranslation(value) {
  return (
    value !== null && typeof value === 'object' && !Array.isArray(value) && 'en' in value && 'vi' in value
  );
}

/**
 * Recursively replaces every { en, vi } object with the string for `language`.
 * Editors may write in one language only, so an empty or missing translation
 * falls back to the other.
 */
export function localize(value, language) {
  if (isTranslation(value)) return value[language] || value.en || value.vi || '';
  if (Array.isArray(value)) return value.map((item) => localize(item, language));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, localize(v, language)]));
  }
  return value;
}
