import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useInView } from './useInView.js';

describe('useInView', () => {
  let trigger;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setup(threshold) {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback) {
          trigger = (ratio) => act(() => callback([{ intersectionRatio: ratio }]));
        }
        observe() {}
        disconnect() {}
      },
    );
    let inView;
    function Probe() {
      const ref = useRef(null);
      inView = useInView(ref, threshold);
      return <div ref={ref} />;
    }
    render(<Probe />);
    return () => inView;
  }

  it('starts out of view, comes in at the threshold, and goes out below it', () => {
    const isInView = setup(0.25);
    expect(isInView()).toBe(false);

    trigger(0.25);
    expect(isInView()).toBe(true);

    trigger(0.1);
    expect(isInView()).toBe(false);
  });

  it('stays in view when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    let inView;
    function Probe() {
      const ref = useRef(null);
      inView = useInView(ref);
      return <div ref={ref} />;
    }
    render(<Probe />);
    expect(inView).toBe(true);
  });
});
