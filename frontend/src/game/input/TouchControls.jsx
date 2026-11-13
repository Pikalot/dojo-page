import { useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import './TouchControls.css';

const PAD = [
  ['up', 0, -1],
  ['left', -1, 0],
  ['right', 1, 0],
  ['down', 0, 1],
];

/**
 * On-screen controls (FR-021): a 4-way pad bottom left, Parry and Strike bottom right.
 * Shown on touch devices, and on desktop when the player switches them on. Pointer Events allow several fingers at once, and each press is stamped with
 * its own event time, exactly like the keyboard, so the parry window is the same on both.
 */
export function TouchControls({ onInput, toSimTime, parryReady = true, strikeReady = true }) {
  const { t } = useLanguage();
  // Directions currently held, one per finger.
  const held = useRef(new Map());

  function sendMove(event) {
    let dx = 0;
    let dy = 0;
    for (const [hx, hy] of held.current.values()) {
      dx += hx;
      dy += hy;
    }
    onInput({ type: 'move', dx: Math.sign(dx), dy: Math.sign(dy), at: toSimTime(event.timeStamp) });
  }

  function padDown(event, dx, dy) {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    held.current.set(event.pointerId, [dx, dy]);
    sendMove(event);
  }

  function padUp(event) {
    if (!held.current.delete(event.pointerId)) return;
    sendMove(event);
  }

  function action(type) {
    // The Parry button can be held to block (FR-006a): letting go sends parryRelease.
    const release =
      type === 'parry'
        ? {
            onPointerUp(event) {
              onInput({ type: 'parryRelease', at: toSimTime(event.timeStamp) });
            },
            onPointerCancel(event) {
              onInput({ type: 'parryRelease', at: toSimTime(event.timeStamp) });
            },
          }
        : {};
    return {
      ...release,
      // With a mouse, keep focus where it is, so Space can't also "click" a focused button.
      onMouseDown(event) {
        event.preventDefault();
      },
      onPointerDown(event) {
        event.preventDefault();
        onInput({ type, at: toSimTime(event.timeStamp) });
      },
      // Keyboard activation (Enter or Space on the focused button) has detail 0.
      onClick(event) {
        if (event.detail !== 0) return;
        const at = toSimTime(event.timeStamp);
        onInput({ type, at });
        if (type === 'parry') onInput({ type: 'parryRelease', at });
      },
    };
  }

  return (
    <div className="touch" role="group" aria-label={t.game.touch.controls}>
      <div className="touch__pad" role="group" aria-label={t.game.touch.move}>
        {PAD.map(([name, dx, dy]) => (
          <button
            key={name}
            type="button"
            className={`touch__button touch__pad-${name}`}
            aria-label={t.game.touch[name]}
            onPointerDown={(event) => padDown(event, dx, dy)}
            onPointerUp={padUp}
            onPointerCancel={padUp}
            onLostPointerCapture={padUp}
            onMouseDown={(event) => event.preventDefault()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span aria-hidden="true" className={`touch__arrow touch__arrow--${name}`} />
          </button>
        ))}
      </div>
      <div className="touch__actions">
        <button
          type="button"
          className={`touch__button touch__strike${strikeReady ? '' : ' touch__button--cooling'}`}
          onContextMenu={(event) => event.preventDefault()}
          {...action('strike')}
        >
          {t.game.touch.strike}
        </button>
        <button
          type="button"
          onLostPointerCapture={(event) => onInput({ type: 'parryRelease', at: toSimTime(event.timeStamp) })}
          className={`touch__button touch__parry${parryReady ? '' : ' touch__button--cooling'}`}
          onContextMenu={(event) => event.preventDefault()}
          {...action('parry')}
        >
          {t.game.touch.parry}
        </button>
      </div>
    </div>
  );
}
