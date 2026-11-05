import { useCallback, useEffect, useState } from 'react';

/**
 * Returns [value, flush]. The value follows `input` once `input` has stopped
 * changing for `delay` ms; flush() catches up immediately, for when someone
 * acts on the result before the wait is over.
 */
export function useDebouncedValue(input, delay) {
  const [value, setValue] = useState(input);

  useEffect(() => {
    const timer = setTimeout(() => setValue(input), delay);
    return () => clearTimeout(timer);
  }, [input, delay]);

  const flush = useCallback(() => setValue(input), [input]);
  return [value, flush];
}
