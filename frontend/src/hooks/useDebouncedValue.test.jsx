import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from './useDebouncedValue.js';

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () =>
    renderHook(({ input }) => useDebouncedValue(input, 150), { initialProps: { input: 'a' } });

  it('starts with the input', () => {
    expect(setup().result.current[0]).toBe('a');
  });

  it('waits until the delay has passed', () => {
    const { result, rerender } = setup();
    rerender({ input: 'ab' });
    act(() => vi.advanceTimersByTime(149));
    expect(result.current[0]).toBe('a');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current[0]).toBe('ab');
  });

  it('restarts the wait on each change, and skips the values in between', () => {
    const { result, rerender } = setup();
    const seen = [];
    for (const input of ['ab', 'abc', 'abcd']) {
      rerender({ input });
      act(() => vi.advanceTimersByTime(100));
      seen.push(result.current[0]);
    }
    expect(seen).toEqual(['a', 'a', 'a']);
    act(() => vi.advanceTimersByTime(50));
    expect(result.current[0]).toBe('abcd');
  });

  it('flush catches up at once', () => {
    const { result, rerender } = setup();
    rerender({ input: 'ab' });
    act(() => result.current[1]());
    expect(result.current[0]).toBe('ab');
  });

  it('leaves no timer running after unmount', () => {
    const { rerender, unmount } = setup();
    rerender({ input: 'ab' });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
