import { useState } from 'react';
import { topicLabel } from '../services/topics.js';

const minutesText = m => (m ? `${m} min` : '');

export function ArchiveCard({ doc, onOpen }) {
  const [broken, setBroken] = useState(false);
  const meta = [doc.year, minutesText(doc.minutes)].filter(Boolean).join(', ');
  return (
    <li>
      <button type="button" className="archive-card" onClick={() => onOpen(doc)}>
        <span className="archive-card__frame">
          {broken ? (
            <span className="archive-card__fallback" aria-hidden="true">{doc.year ?? 'Film'}</span>
          ) : (
            <img src={doc.thumb} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
          )}
        </span>
        <span className="archive-card__title">{doc.title}</span>
        {meta && <span className="card-meta">{meta}</span>}
      </button>
    </li>
  );
}

export function ModernCard({ doc, onOpen }) {
  const band = doc.topics[0] ?? 'none';
  return (
    <li>
      <button type="button" className={`title-card title-card--${band}`} onClick={() => onOpen(doc)}>
        <span className="title-card__year">{doc.year ?? 'Undated'}</span>
        <span className="title-card__title">{doc.title}</span>
        {doc.director && <span className="card-meta">Directed by {doc.director}</span>}
        {doc.topics.length > 0 && (
          <span className="title-card__topics">{doc.topics.map(topicLabel).join(', ')}</span>
        )}
      </button>
    </li>
  );
}
