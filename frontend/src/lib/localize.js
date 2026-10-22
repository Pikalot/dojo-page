function isTranslation(value) {
  return (
    value !== null && typeof value === 'object' && !Array.isArray(value) && 'en' in value && 'vi' in value
  );
}

/** Recursively replaces every { en, vi } object with the string for `language`. */
export function localize(value, language) {
  if (isTranslation(value)) return value[language] ?? value.en;
  if (Array.isArray(value)) return value.map((item) => localize(item, language));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, localize(v, language)]));
  }
  return value;
}
