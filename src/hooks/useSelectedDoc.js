import { useEffect, useState } from 'react';
import { fetchArchiveDoc } from '../services/archive.js';

// Turns the documentary id in the address into a documentary to show.
// Looks in what is already loaded first. An archive film from a shared link is fetched on its own.
// status: 'none' (no id), 'loading', 'ready' or 'missing' (the link points to nothing we can show)
export function useSelectedDoc({ collection, docId, archiveItems, modernDocs, modernLoaded }) {
  const [fetched, setFetched] = useState({ id: '', doc: null, status: 'none' });

  const known = !docId ? null
    : collection === 'modern' ? modernDocs.find(d => d.id === docId)
    : archiveItems.find(d => d.id === docId);
  const needsFetch = Boolean(docId && !known && collection === 'archive');

  useEffect(() => {
    if (!needsFetch) return undefined;
    const ctrl = new AbortController();
    fetchArchiveDoc(docId, { signal: ctrl.signal })
      .then(doc => setFetched({ id: docId, doc, status: doc ? 'ready' : 'missing' }))
      .catch(err => {
        if (err.name !== 'AbortError') setFetched({ id: docId, doc: null, status: 'missing' });
      });
    return () => ctrl.abort();
  }, [needsFetch, docId]);

  if (!docId) return { doc: null, status: 'none' };
  if (known) return { doc: known, status: 'ready' };
  if (collection === 'modern') return { doc: null, status: modernLoaded ? 'missing' : 'loading' };
  return fetched.id === docId ? fetched : { doc: null, status: 'loading' };
}
