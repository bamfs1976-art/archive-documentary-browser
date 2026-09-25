import { useCallback, useEffect, useRef, useState } from 'react';
import { buildSearch, parseUrl } from '../services/url.js';

const addressFor = state => buildSearch(state) || window.location.pathname;

// Keeps collection, topic, sort, search and the open documentary in the address bar.
// Every change adds a history entry, so Back and Forward step through what the visitor did.
export function useUrlState() {
  const [state, setState] = useState(() => parseUrl(window.location.search));
  const current = useRef(state);

  useEffect(() => {
    // Tidy a hand-typed or outdated address without adding a history entry
    window.history.replaceState(window.history.state, '', addressFor(current.current));
    const onPop = () => {
      const next = parseUrl(window.location.search);
      current.current = next;
      setState(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // `fromList` marks a details panel opened from the grid, so closing it can step back instead of piling up entries
  const navigate = useCallback((patch, { replace = false, fromList = false } = {}) => {
    const next = { ...current.current, ...patch };
    if (buildSearch(next) === buildSearch(current.current)) return;
    window.history[replace ? 'replaceState' : 'pushState']({ fromList }, '', addressFor(next));
    current.current = next;
    setState(next);
  }, []);

  return [state, navigate, current];
}
