// Scrolls to a section and moves keyboard focus to its heading, so screen
// reader and keyboard users land where sighted users see the page jump to.
// `scroll: false` is for when the caller scrolls somewhere more precise itself.
export function scrollToSection(id, { instant = false, scroll = true } = {}) {
  const section = document.getElementById(id);
  if (!section) return;

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // 'instant', not 'auto': 'auto' follows the page's smooth-scrolling CSS.
  const behavior = instant || reduceMotion ? 'instant' : 'smooth';
  if (scroll) section.scrollIntoView({ behavior, block: 'start' });

  const heading = section.querySelector('h2');
  heading?.focus({ preventScroll: true });

  // Keep the URL shareable without triggering a second, instant jump.
  window.history.replaceState(null, '', `#${id}`);
}
