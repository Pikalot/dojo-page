// Lets several callers share one request for the life of the page. A failed
// request isn't kept, so the next caller tries again.
const results = new Map();

export function shareResult(key, load) {
  if (!results.has(key)) {
    results.set(
      key,
      load().catch((error) => {
        results.delete(key);
        throw error;
      }),
    );
  }
  return results.get(key);
}

export function clearSharedResults() {
  results.clear();
}
