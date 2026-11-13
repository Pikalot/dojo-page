/**
 * Maps keys to game inputs. Each input is stamped with the key event's own timestamp,
 * converted to simulation time, so a parry is judged at the moment of the press.
 */
const MOVE_KEYS = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
  KeyW: [0, -1],
  KeyS: [0, 1],
};

const SCROLL_KEYS = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

export function attachKeyboard(target, onInput, clock, { onPause } = {}) {
  const held = new Set();
  // Space is held for hold-to-block (FR-006a); letting go sends parryRelease.
  let spaceDown = false;

  function direction() {
    let dx = 0;
    let dy = 0;
    for (const code of held) {
      dx += MOVE_KEYS[code][0];
      dy += MOVE_KEYS[code][1];
    }
    return { dx: Math.sign(dx), dy: Math.sign(dy) };
  }

  function onKeyDown(event) {
    // Leave browser and system shortcuts alone.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const { code } = event;
    if (SCROLL_KEYS.has(code)) event.preventDefault();
    const at = clock.toSimTime(event.timeStamp);

    if (MOVE_KEYS[code]) {
      if (held.has(code)) return;
      held.add(code);
      onInput({ type: 'move', ...direction(), at });
    } else if (code === 'Space') {
      if (!event.repeat && !spaceDown) {
        spaceDown = true;
        onInput({ type: 'parry', at });
      }
    } else if (code === 'KeyJ') {
      if (!event.repeat) onInput({ type: 'strike', at });
    } else if (code === 'Escape' || code === 'KeyP') {
      if (!event.repeat) onPause?.();
    }
  }

  function onKeyUp(event) {
    if (event.code === 'Space' && spaceDown) {
      spaceDown = false;
      onInput({ type: 'parryRelease', at: clock.toSimTime(event.timeStamp) });
      return;
    }
    if (!MOVE_KEYS[event.code] || !held.has(event.code)) return;
    held.delete(event.code);
    onInput({ type: 'move', ...direction(), at: clock.toSimTime(event.timeStamp) });
  }

  // Releasing keys while the window is in the background never sends keyup.
  function onBlur() {
    const at = clock.simTime ?? 0;
    if (spaceDown) {
      spaceDown = false;
      onInput({ type: 'parryRelease', at });
    }
    if (held.size === 0) return;
    held.clear();
    onInput({ type: 'move', dx: 0, dy: 0, at });
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  return () => {
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
  };
}
