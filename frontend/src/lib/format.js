const LOCALES = { en: 'en-US', vi: 'vi-VN' };

// Intl throws on an invalid date, so missing or malformed values format as ''.
function format(date, language, options) {
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(LOCALES[language] ?? LOCALES.en, options).format(date);
}

/** Formats "19:00" as "7:00 PM" (en) or "19:00" (vi). */
export function formatTime(hhmm, language) {
  const [hours, minutes] = String(hhmm).split(':').map(Number);
  return format(new Date(2000, 0, 1, hours, minutes), language, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Formats an ISO date ("2026-11-01") in the reader's language, without timezone shifts. */
export function formatDate(isoDate, language) {
  const [year, month, day] = String(isoDate).split('-').map(Number);
  return format(new Date(year, month - 1, day), language, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
