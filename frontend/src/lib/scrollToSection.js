// Scrolls to a section and moves keyboard focus to its heading, so screen
// reader and keyboard users land where sighted users see the page jump to.
export function scrollToSection(id) {
  const section = document.getElementById(id);
  if (!section) return;

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });

  const heading = section.querySelector('h2');
  heading?.focus({ preventScroll: true });

  // Keep the URL shareable without triggering a second, instant jump.
  window.history.replaceState(null, '', `#${id}`);
}
