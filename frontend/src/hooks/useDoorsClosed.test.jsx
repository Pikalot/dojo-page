import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDoorsClosed, visibleFraction } from './useDoorsClosed.js';

const entry = ({ element, visible, viewport = 800 }) => ({
  boundingClientRect: { height: element },
  intersectionRect: { height: visible },
  rootBounds: { height: viewport },
});

describe('visibleFraction', () => {
  it('is the visible share of an element shorter than the viewport', () => {
    expect(visibleFraction(entry({ element: 600, visible: 300 }))).toBe(0.5);
  });

  it('measures against the viewport when the element is taller than the screen', () => {
    // 1000px hero on an 800px screen, filling the screen: counts as fully visible.
    expect(visibleFraction(entry({ element: 1000, visible: 800 }))).toBe(1);
  });

  it('is 0 for an element with no height', () => {
    expect(visibleFraction(entry({ element: 0, visible: 0 }))).toBe(0);
  });
});

describe('useDoorsClosed', () => {
  let trigger;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setup() {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback) {
          trigger = (e) => act(() => callback([e]));
        }
        observe() {}
        disconnect() {}
      },
    );
    let closed;
    function Probe() {
      const ref = useRef(null);
      closed = useDoorsClosed(ref);
      return <div ref={ref} />;
    }
    render(<Probe />);
    return () => closed;
  }

  it('starts open, closes below 2/3 visible, and reopens above it', () => {
    const isClosed = setup();
    expect(isClosed()).toBe(false);

    trigger(entry({ element: 600, visible: 380 })); // ~63% visible
    expect(isClosed()).toBe(true);

    trigger(entry({ element: 600, visible: 420 })); // 70% visible
    expect(isClosed()).toBe(false);
  });
});
