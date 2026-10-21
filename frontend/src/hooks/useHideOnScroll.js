import { useEffect, useRef, useState } from 'react';

/**
 * Returns true when the header should be hidden: the user is scrolling down
 * and has moved past `offset` pixels. Scrolling up reveals it again.
 * Small movements under `threshold` are ignored to avoid flicker.
 */
export function useHideOnScroll({ offset = 80, threshold = 8 } = {}) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;

    const update = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (y <= offset) setHidden(false);
      else if (delta > threshold) setHidden(true);
      else if (delta < -threshold) setHidden(false);
      if (Math.abs(delta) > threshold || y <= offset) lastY.current = y;
      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        window.requestAnimationFrame(update);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [offset, threshold]);

  return hidden;
}
