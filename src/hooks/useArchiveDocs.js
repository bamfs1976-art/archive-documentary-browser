import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchArchiveDocs, PAGE_SIZE } from '../services/archive.js';

export function useArchiveDocs({ topic, sort, query, enabled }) {
  const [state, setState] = useState({ items: [], total: 0, page: 1, loading: false, error: '' });
  const [attempt, setAttempt] = useState(0);
  const controller = useRef(null);

  const load = useCallback(async (page, append) => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setState(s => ({ ...s, loading: true, error: '', ...(append ? {} : { items: [], total: 0 }) }));
    try {
      const { items, total } = await fetchArchiveDocs({ topic, sort, query, page, signal: ctrl.signal });
      setState(s => {
        const known = new Set(append ? s.items.map(i => i.id) : []);
        const merged = append ? [...s.items, ...items.filter(i => !known.has(i.id))] : items;
        return { items: merged, total, page, loading: false, error: '' };
      });
    } catch (err) {
      if (err.name === 'AbortError') return;
      setState(s => ({ ...s, loading: false, error: 'Archive.org did not respond. Check your connection, then try again.' }));
    }
  }, [topic, sort, query]);

  useEffect(() => {
    if (enabled) load(1, false);
    return () => controller.current?.abort();
  }, [enabled, load, attempt]);

  const hasMore = state.items.length < state.total && state.page * PAGE_SIZE < state.total;
  return {
    ...state,
    hasMore,
    loadMore: () => load(state.page + 1, true),
    retry: () => setAttempt(a => a + 1)
  };
}
