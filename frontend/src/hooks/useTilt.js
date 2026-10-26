import { useEffect } from 'react';

// Largest tilt, in degrees, reached when the pointer is at a panel's edge.
export const MAX_TILT = 6;

/**
 * Tilts whichever direct child of the container is under the pointer toward
 * the pointer, by setting --tilt-x and --tilt-y on it for CSS to use. Skipped
 * on touch screens and for visitors who ask for less motion, where the CSS
 * defaults (0deg) leave the panel flat.
 */
export function useTilt(ref) {
  useEffect(() => {
    const container = ref.current;
    const canHover = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!container || !canHover || reduceMotion) return undefined;

    const reset = (card) => {
      card.style.removeProperty('--tilt-x');
      card.style.removeProperty('--tilt-y');
    };

    const onMove = (event) => {
      for (const card of container.children) {
        if (!card.contains(event.target)) {
          reset(card);
          continue;
        }
        const rect = card.getBoundingClientRect();
        // Pointer position across the card, from -0.5 (left/top) to 0.5 (right/bottom).
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty('--tilt-x', `${(-y * 2 * MAX_TILT).toFixed(2)}deg`);
        card.style.setProperty('--tilt-y', `${(x * 2 * MAX_TILT).toFixed(2)}deg`);
      }
    };

    const onLeave = () => {
      for (const card of container.children) reset(card);
    };

    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerleave', onLeave);
    return () => {
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerleave', onLeave);
      onLeave();
    };
  }, [ref]);
}
