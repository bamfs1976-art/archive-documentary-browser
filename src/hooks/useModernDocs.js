import { useEffect, useState } from 'react';
import { fetchModernDocs } from '../services/wikidata.js';

export function useModernDocs(enabled) {
  const [state, setState] = useState({ docs: [], loading: false, error: '' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || state.docs.length) return undefined;
    const ctrl = new AbortController();
    setState(s => ({ ...s, loading: true, error: '' }));
    fetchModernDocs({ signal: ctrl.signal, fresh: attempt > 0 })
      .then(docs => setState({ docs, loading: false, error: '' }))
      .catch(err => {
        if (err.name === 'AbortError') return;
        setState({ docs: [], loading: false, error: 'Wikidata did not respond. The service slows down at busy times, so try again in a minute.' });
      });
    return () => ctrl.abort();
  }, [enabled, attempt, state.docs.length]);

  return { ...state, retry: () => setAttempt(a => a + 1) };
}
