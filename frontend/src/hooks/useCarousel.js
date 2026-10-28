import { useCallback, useEffect, useState } from 'react';

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

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    const update = () => {
      // A hidden track (e.g. inside a closed dialog) has no width.
      if (el.clientWidth > 0) setIndex(Math.round(el.scrollLeft / el.clientWidth));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    return () => el.removeEventListener('scroll', update);
  }, [trackRef, count]);

  const goTo = useCallback(
    (target, { instant = false } = {}) => {
      const el = trackRef.current;
      if (!el) return;
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollTo?.({ left: target * el.clientWidth, behavior: instant || reduceMotion ? 'auto' : 'smooth' });
      setIndex(target);
    },
    [trackRef],
  );

  return { index, goTo };
}
