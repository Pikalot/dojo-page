import { useEffect } from 'react';
import { scrollToSection } from '../lib/scrollToSection.js';
import { SECTIONS } from '../sections.js';

// Content loads after the first render and moves the sections down, so keep
// re-aligning for a moment. Long enough for a slow response, short enough not
// to surprise anyone.
const SETTLE_MS = 3000;
const USER_INPUT_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'];

/**
 * Jumps to the section named in the URL (e.g. a shared /#schedule link). The
 * browser cannot do this itself, because the sections do not exist until React
 * has rendered them. Stops as soon as the visitor scrolls or types.
 */
export function useScrollToHash(containerRef) {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!SECTIONS.some((section) => section.id === id)) return undefined;

    const jump = () => scrollToSection(id, { instant: true });
    jump();

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(jump) : null;
    if (containerRef.current) observer?.observe(containerRef.current);

    const stop = () => {
      observer?.disconnect();
      clearTimeout(timer);
      USER_INPUT_EVENTS.forEach((name) => window.removeEventListener(name, stop));
    };
    const timer = setTimeout(stop, SETTLE_MS);
    USER_INPUT_EVENTS.forEach((name) => window.addEventListener(name, stop, { passive: true }));
    return stop;
  }, [containerRef]);
}
