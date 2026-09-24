import { useMemo, useState } from 'react';
import { TOPICS } from './services/topics.js';
import { filterModern } from './services/wikidata.js';
import { useArchiveDocs } from './hooks/useArchiveDocs.js';
import { useModernDocs } from './hooks/useModernDocs.js';
import { ArchiveCard, ModernCard } from './components/Cards.jsx';
import DetailDialog from './components/DetailDialog.jsx';

const MODERN_PAGE = 48;

const SOURCES = [
  { id: 'archive', label: 'Archive films', hint: 'Watch free here. Mostly 1930s to 1970s.' },
  { id: 'modern', label: 'Modern documentaries', hint: 'Since 1980. Find where to stream in the UK.' }
];

const SORT_LABELS = {
  archive: { popular: 'Most watched', oldest: 'Oldest first', newest: 'Newest first', title: 'A to Z' },
  modern: { popular: 'Best known', newest: 'Newest first', oldest: 'Oldest first', title: 'A to Z' }
};

export default function App() {
  const [source, setSource] = useState('archive');
  const [topic, setTopic] = useState('all');
  const [sort, setSort] = useState('popular');
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [modernShown, setModernShown] = useState(MODERN_PAGE);

  const archive = useArchiveDocs({ topic, sort, query, enabled: source === 'archive' });
  const modern = useModernDocs(source === 'modern');

  const modernMatches = useMemo(
    () => filterModern(modern.docs, { topic, query, sort }),
    [modern.docs, topic, query, sort]
  );

  const resetPaging = () => setModernShown(MODERN_PAGE);
  const choose = setter => value => { setter(value); resetPaging(); };

  const onSearch = event => {
    event.preventDefault();
    setQuery(draft.trim());
    resetPaging();
  };
  const clearSearch = () => { setDraft(''); setQuery(''); resetPaging(); };

  const isArchive = source === 'archive';
  const loading = isArchive ? archive.loading : modern.loading;
  const error = isArchive ? archive.error : modern.error;
  const retry = isArchive ? archive.retry : modern.retry;
  const items = isArchive ? archive.items : modernMatches.slice(0, modernShown);
  const total = isArchive ? archive.total : modernMatches.length;
  const hasMore = isArchive ? archive.hasMore : modernShown < modernMatches.length;
  const loadMore = isArchive ? archive.loadMore : () => setModernShown(n => n + MODERN_PAGE);

  let status = '';
  if (loading && !items.length) status = isArchive ? 'Loading films from Archive.org' : 'Loading documentaries from Wikidata. The first load takes up to 30 seconds.';
  else if (!error) status = `${total.toLocaleString('en-GB')} ${total === 1 ? 'documentary' : 'documentaries'} found`;

  return (
    <div className="page">
      <a className="skip" href="#results">Skip to results</a>
      <header className="masthead">
        <h1>Documentary Browser</h1>
        <p className="lede">Watch free archive documentaries, or find where to stream modern ones in the UK.</p>
      </header>

      <main>
        <nav className="sources" aria-label="Choose a collection">
          {SOURCES.map(s => (
            <button
              key={s.id}
              type="button"
              className="source"
              aria-pressed={source === s.id}
              onClick={() => { setSource(s.id); resetPaging(); }}
            >
              <span className="source__label">{s.label}</span>
              <span className="source__hint">{s.hint}</span>
            </button>
          ))}
        </nav>

        <section className="controls" aria-label="Filter documentaries">
          <div className="topics" role="group" aria-label="Topic">
            {TOPICS.map(t => (
              <button key={t.id} type="button" className="pill" aria-pressed={topic === t.id} onClick={() => choose(setTopic)(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="toolbar">
            <form className="search" role="search" onSubmit={onSearch}>
              <label htmlFor="search-input" className="visually-hidden">Search documentaries</label>
              <input
                id="search-input"
                type="search"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Search titles, subjects or directors"
                autoComplete="off"
              />
              <button type="submit" className="button button--primary">Search</button>
              {query && <button type="button" className="button" onClick={clearSearch}>Clear</button>}
            </form>

            <label className="sort">
              <span>Sort</span>
              <select value={sort} onChange={e => choose(setSort)(e.target.value)}>
                {Object.entries(SORT_LABELS[source]).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section id="results" className="results" aria-labelledby="results-heading" tabIndex={-1}>
          <h2 id="results-heading" className="visually-hidden">Results</h2>
          <p className="status" role="status" aria-live="polite">{status}</p>

          {error && (
            <div className="message" role="alert">
              <p>{error}</p>
              <button type="button" className="button button--primary" onClick={retry}>Try again</button>
            </div>
          )}

          {!loading && !error && total === 0 && (
            <div className="message">
              <p>No documentaries match. Pick another topic or clear your search.</p>
            </div>
          )}

          <ul className={isArchive ? 'grid grid--archive' : 'grid grid--modern'}>
            {items.map(doc =>
              isArchive
                ? <ArchiveCard key={doc.id} doc={doc} onOpen={setSelected} />
                : <ModernCard key={doc.id} doc={doc} onOpen={setSelected} />
            )}
          </ul>

          {hasMore && !error && (
            <div className="more">
              <button type="button" className="button" onClick={loadMore} disabled={loading}>
                {loading ? 'Loading' : 'Show more'}
              </button>
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <p>
          Films and thumbnails from the <a href="https://archive.org" target="_blank" rel="noopener noreferrer">Internet Archive</a>.
          Modern titles from <a href="https://www.wikidata.org" target="_blank" rel="noopener noreferrer">Wikidata</a>.
          Streaming search by <a href="https://www.justwatch.com/uk" target="_blank" rel="noopener noreferrer">JustWatch</a>.
          None of them endorse this site.
        </p>
        <p>Based on the idea of archive-movie-browser by amponce, MIT licence.</p>
      </footer>

      <DetailDialog doc={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
