// Lets the search box in the navbar open a profile modal or highlight a name in
// the Instructors section, without either component knowing about the other.
const EVENT = 'dojo:open-instructor-profile';
const HIGHLIGHT_EVENT = 'dojo:highlight-black-belt';

export function openInstructorProfile(id) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
}

/** Calls handler(id) on each request. Returns a function that stops listening. */
export function onInstructorProfileRequest(handler) {
  const listener = (event) => handler(event.detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

export function highlightBlackBelt(id) {
  window.dispatchEvent(new CustomEvent(HIGHLIGHT_EVENT, { detail: id }));
}

/** Calls handler(id) on each request. Returns a function that stops listening. */
export function onBlackBeltHighlightRequest(handler) {
  const listener = (event) => handler(event.detail);
  window.addEventListener(HIGHLIGHT_EVENT, listener);
  return () => window.removeEventListener(HIGHLIGHT_EVENT, listener);
}
