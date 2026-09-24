import { useEffect, useRef, useState } from 'react';
import { shorten } from '../services/text.js';
import { topicLabel } from '../services/topics.js';

function ArchiveDetail({ doc }) {
  const [playing, setPlaying] = useState(false);
  const facts = [doc.year, doc.minutes && `${doc.minutes} minutes`, doc.creator].filter(Boolean).join(', ');
  return (
    <>
      <div className="player">
        {playing ? (
          <iframe
            src={doc.embed}
            title={`Player: ${doc.title}`}
            allow="fullscreen; autoplay"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button type="button" className="player__start" onClick={() => setPlaying(true)}>
            <img src={doc.thumb} alt="" />
            <span className="button button--primary">Watch now</span>
          </button>
        )}
      </div>
      <h2 id="dialog-title">{doc.title}</h2>
      {facts && <p className="facts">{facts}</p>}
      {doc.description && <p className="summary">{shorten(doc.description, 900)}</p>}
      {doc.subjects.length > 0 && <p className="facts">Tagged: {doc.subjects.join(', ')}</p>}
      <p className="links">
        <a className="button" href={doc.page} target="_blank" rel="noopener noreferrer">Open on Archive.org</a>
      </p>
    </>
  );
}

function ModernDetail({ doc }) {
  const facts = [doc.year, doc.minutes && `${doc.minutes} minutes`, doc.director && `directed by ${doc.director}`]
    .filter(Boolean).join(', ');
  return (
    <>
      <h2 id="dialog-title">{doc.title}</h2>
      {facts && <p className="facts">{facts}</p>}
      {doc.description && <p className="summary">{doc.description}</p>}
      {doc.subjects.length > 0 && <p className="facts">About: {doc.subjects.join(', ')}</p>}
      {doc.topics.length > 0 && <p className="facts">Topics: {doc.topics.map(topicLabel).join(', ')}</p>}
      <p className="links">
        <a className="button button--primary" href={doc.watch} target="_blank" rel="noopener noreferrer">
          Where to watch in the UK
        </a>
        {doc.wikipedia && (
          <a className="button" href={doc.wikipedia} target="_blank" rel="noopener noreferrer">Read on Wikipedia</a>
        )}
        <a className="button" href={doc.wikidata} target="_blank" rel="noopener noreferrer">Wikidata record</a>
      </p>
      <p className="note">Streaming search opens JustWatch UK in a new tab.</p>
    </>
  );
}

export default function DetailDialog({ doc, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (doc && !dialog.open) dialog.showModal();
    if (!doc && dialog.open) dialog.close();
  }, [doc]);

  return (
    <dialog
      ref={ref}
      className="detail"
      aria-labelledby="dialog-title"
      onClose={onClose}
      onClick={e => { if (e.target === ref.current) onClose(); }}
    >
      {doc && (
        <div className="detail__body">
          <button type="button" className="detail__close" onClick={onClose} aria-label="Close details">×</button>
          {doc.kind === 'archive' ? <ArchiveDetail key={doc.id} doc={doc} /> : <ModernDetail doc={doc} />}
        </div>
      )}
    </dialog>
  );
}
