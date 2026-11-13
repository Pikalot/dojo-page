import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachKeyboard } from './keyboard.js';

const clock = { toSimTime: (ts) => ts - 1000, simTime: 0 };

function key(type, code, init = {}) {
  const event = new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
}

describe('attachKeyboard', () => {
  let inputs;
  let onPause;
  let detach;

  beforeEach(() => {
    inputs = [];
    onPause = vi.fn();
    detach = attachKeyboard(window, (input) => inputs.push(input), clock, { onPause });
  });

  afterEach(() => detach());

  it('maps arrows and WASD to movement, combining held keys', () => {
    key('keydown', 'ArrowRight');
    key('keydown', 'KeyW');
    key('keyup', 'ArrowRight');
    expect(inputs.map(({ dx, dy }) => [dx, dy])).toEqual([
      [1, 0],
      [1, -1],
      [0, -1],
    ]);
  });

  it('maps Space to parry and J to strike, stamped with simulation time', () => {
    key('keydown', 'Space');
    key('keydown', 'KeyJ');
    expect(inputs.map((i) => i.type)).toEqual(['parry', 'strike']);
    for (const input of inputs) expect(typeof input.at).toBe('number');
  });

  it('ignores key repeat for parry and strike', () => {
    key('keydown', 'Space', { repeat: true });
    key('keydown', 'KeyJ', { repeat: true });
    expect(inputs).toEqual([]);
  });

  it('sends parryRelease when Space is let go (hold to block)', () => {
    key('keydown', 'Space');
    key('keyup', 'Space');
    expect(inputs.map((i) => i.type)).toEqual(['parry', 'parryRelease']);
  });

  it('releases a held Space when the window loses focus', () => {
    key('keydown', 'Space');
    window.dispatchEvent(new Event('blur'));
    expect(inputs.map((i) => i.type)).toEqual(['parry', 'parryRelease']);
  });

  it('pauses on Escape and P', () => {
    key('keydown', 'Escape');
    key('keydown', 'KeyP');
    expect(onPause).toHaveBeenCalledTimes(2);
  });

  it('stops Space and arrow keys from scrolling the page', () => {
    expect(key('keydown', 'Space').defaultPrevented).toBe(true);
    expect(key('keydown', 'ArrowDown').defaultPrevented).toBe(true);
    expect(key('keydown', 'KeyJ').defaultPrevented).toBe(false);
  });

  it('stops listening after detach', () => {
    detach();
    key('keydown', 'Space');
    expect(inputs).toEqual([]);
  });
});
