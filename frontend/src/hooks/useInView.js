import { useEffect, useState } from 'react';

/**
 * Returns true while at least `threshold` of the element is on screen.
 * Starts false so an entrance effect plays from the start, unless
 * IntersectionObserver is missing, in which case it stays true.
 */
export function useInView(ref, threshold = 0.25) {
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.intersectionRatio >= threshold),
      { threshold: [0, threshold] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, threshold]);

  return inView;
}
