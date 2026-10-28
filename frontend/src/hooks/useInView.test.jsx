import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useInView } from './useInView.js';

describe('useInView', () => {
  let trigger;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  let options;

  function setup(threshold, triggerLine) {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback, observerOptions) {
          trigger = (ratio) => act(() => callback([{ intersectionRatio: ratio }]));
          options = observerOptions;
        }
        observe() {}
        disconnect() {}
      },
    );
    let inView;
    function Probe() {
      const ref = useRef(null);
      inView = useInView(ref, threshold, triggerLine);
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

  it('counts the whole viewport by default, or only above the trigger line', () => {
    setup(0.25);
    expect(options.rootMargin).toBe('0px 0px 0% 0px');

    setup(0.25, 0.5);
    expect(options.rootMargin).toBe('0px 0px -50% 0px');
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
