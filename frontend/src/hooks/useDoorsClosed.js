import { useEffect, useState } from 'react';

// Doors close once less than this share of the element is on screen
// (i.e. more than 1/3 has scrolled out) and open again above it.
export const VISIBLE_THRESHOLD = 2 / 3;

// Fire the observer every 5% of visibility change.
const STEPS = Array.from({ length: 21 }, (_, i) => i / 20);

/**
 * Share of the element that is visible, measured against whichever is smaller:
 * the element or the viewport. Without this, an element taller than the screen
 * (e.g. a phone in landscape) could never reach the threshold and the doors
 * would stay shut.
 */
export function visibleFraction(entry) {
  const elementHeight = entry.boundingClientRect.height;
  const viewportHeight = entry.rootBounds?.height ?? window.innerHeight;
  const fullyVisibleHeight = Math.min(elementHeight, viewportHeight);
  if (fullyVisibleHeight <= 0) return 0;
  return entry.intersectionRect.height / fullyVisibleHeight;
}

/** Returns true while the element is scrolled more than 1/3 out of view. */
export function useDoorsClosed(ref) {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setClosed(visibleFraction(entry) < VISIBLE_THRESHOLD),
      { threshold: STEPS },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return closed;
}
