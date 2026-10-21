const LOCALES = { en: 'en-US', vi: 'vi-VN' };

/** Formats "19:00" as "7:00 PM" (en) or "19:00" (vi). */
export function formatTime(hhmm, language) {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const date = new Date(2000, 0, 1, hours, minutes);
  return new Intl.DateTimeFormat(LOCALES[language] ?? LOCALES.en, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/** Formats an ISO date ("2026-11-01") in the reader's language, without timezone shifts. */
export function formatDate(isoDate, language) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat(LOCALES[language] ?? LOCALES.en, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(year, month - 1, day));
}
