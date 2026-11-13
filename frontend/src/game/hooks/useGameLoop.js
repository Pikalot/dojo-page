import { useEffect, useRef } from 'react';
import { step } from '../engine/session.js';
import { STEP_MS } from '../engine/tuning.js';
import { drawFrame } from '../render/draw.js';

/**
 * Runs the game while `running` is true: each animation frame asks the clock how many
 * fixed steps are due, steps the engine that many times, reports the events, then draws.
 * Calls `onNoCanvas` if the browser can't draw on a canvas.
 */
export function useGameLoop({ canvasRef, sessionRef, clockRef, running, reducedMotion, character, onFrame, onNoCanvas }) {
  // Keep the latest callbacks without restarting the loop.
  const latest = useRef({ onFrame, onNoCanvas, reducedMotion, character });
  latest.current = { onFrame, onNoCanvas, reducedMotion, character };

  // Match the canvas's pixel size to its box, for sharp drawing on high-density screens.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    function resize() {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    }
    resize();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
    // Not tied to `running`: resizing clears the canvas, and the last frame should stay
    // visible behind the results screen.
  }, [canvasRef]);

  useEffect(() => {
    if (!running) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.('2d');
    if (!ctx) {
      latest.current.onNoCanvas?.();
      return undefined;
    }
    let frame = 0;
    function tick(now) {
      const session = sessionRef.current;
      const clock = clockRef.current;
      const steps = clock.advance(now);
      const events = [];
      for (let i = 0; i < steps; i += 1) events.push(...step(session, STEP_MS));
      latest.current.onFrame?.(events, session);
      drawFrame(ctx, session, { reducedMotion: latest.current.reducedMotion, character: latest.current.character });
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, canvasRef, sessionRef, clockRef]);
}
