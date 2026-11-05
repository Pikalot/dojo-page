import { useCallback, useEffect, useRef, useState } from 'react';

// How close to a slide counts as arriving, as a fraction of a slide. Slide
// widths can be fractional, so the scroll position may never match exactly.
const ARRIVED = 0.02;

/**
 * Tracks which slide of a horizontal scroll-snap track is showing, one slide
 * per track width. Swiping and trackpads scroll the track natively; goTo()
 * scrolls it from code (arrow buttons, keyboard). `count` re-attaches the
 * listener once the slides have loaded.
 *
 * Returns { index, goTo(index, { instant }) }.
 */
export function useCarousel(trackRef, count) {
  const [index, setIndex] = useState(0);
  // The slide goTo() is on its way to. While set, scroll events report positions
  // part-way there, which must not overwrite index: the counter would jump back,
  // and a quick second click would step from the old slide.
  const pendingRef = useRef(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    const update = () => {
      // A hidden track (e.g. inside a closed dialog) has no width.
      if (el.clientWidth === 0) return;
      const position = el.scrollLeft / el.clientWidth;
      if (pendingRef.current !== null) {
        if (Math.abs(position - pendingRef.current) > ARRIVED) return;
        pendingRef.current = null;
      }
      setIndex(Math.round(position));
    };
    // The visitor taking over, or the scroll stopping early, ends the wait.
    const release = () => {
      pendingRef.current = null;
    };
    const onScrollEnd = () => {
      release();
      update();
    };
    const userInput = ['pointerdown', 'touchstart', 'wheel'];

    update();
    el.addEventListener('scroll', update, { passive: true });
    el.addEventListener('scrollend', onScrollEnd);
    userInput.forEach((name) => el.addEventListener(name, release, { passive: true }));
    return () => {
      el.removeEventListener('scroll', update);
      el.removeEventListener('scrollend', onScrollEnd);
      userInput.forEach((name) => el.removeEventListener(name, release));
    };
  }, [trackRef, count]);

  const goTo = useCallback(
    (target, { instant = false } = {}) => {
      const el = trackRef.current;
      if (!el) return;
      // Already there means no scroll event will ever clear the wait.
      const arrived = el.clientWidth === 0 || Math.abs(el.scrollLeft / el.clientWidth - target) <= ARRIVED;
      pendingRef.current = arrived ? null : target;
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollTo?.({ left: target * el.clientWidth, behavior: instant || reduceMotion ? 'auto' : 'smooth' });
      setIndex(target);
    },
    [trackRef],
  );

  return { index, goTo };
}
