import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { localize } from '../lib/localize.js';

/**
 * Loads one content resource and returns it in the current language.
 * `load` must be a stable function, such as one exported from api/content.js.
 *
 * Returns { status: 'loading' | 'ready' | 'error', data }.
 * Switching language re-localizes the data already loaded; it does not refetch.
 */
export function useContent(load) {
  const { language } = useLanguage();
  const [state, setState] = useState({ status: 'loading', raw: null });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', raw: null });
    load().then(
      (raw) => !cancelled && setState({ status: 'ready', raw }),
      () => !cancelled && setState({ status: 'error', raw: null }),
    );
    return () => {
      cancelled = true;
    };
  }, [load]);

  const data = useMemo(
    () => (state.raw === null ? null : localize(state.raw, language)),
    [state.raw, language],
  );

  return { status: state.status, data };
}
