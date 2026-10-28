import { useEffect, useState } from 'react';

/**
 * Returns true while at least `threshold` of the element is on screen.
 * Starts false so an entrance effect plays from the start, unless
 * IntersectionObserver is missing, in which case it stays true.
 *
 * `triggerLine` moves the bottom of "on screen" up, as a fraction of the
 * viewport height: 0.5 waits until the element has risen past the middle.
 */
export function useInView(ref, threshold = 0.25, triggerLine = 0) {
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.intersectionRatio >= threshold),
      { threshold: [0, threshold], rootMargin: `0px 0px ${-triggerLine * 100}% 0px` },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, threshold, triggerLine]);

  return inView;
}
