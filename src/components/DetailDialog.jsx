import { useEffect, useRef, useState } from 'react';
import { listText, shorten } from '../services/text.js';
import { makerLabel, shortcutLabel, topicLabel } from '../services/topics.js';

// The address already holds this documentary, so sharing means copying it
function CopyLink() {
  const [message, setMessage] = useState('');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage('Link copied');
    } catch {
      setMessage('Copying is blocked here. Share the address from your browser bar instead.');
    }
  };
  return (
    <>
      <button type="button" className="button" onClick={copy}>Copy link</button>
      <span className="copy-status" role="status" aria-live="polite">{message}</span>
    </>
  );
}

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
        <CopyLink />
      </p>
    </>
  );
}

function ModernDetail({ doc }) {
  const facts = [
    doc.year,
    doc.format === 'series' && 'series',
    doc.minutes && `${doc.minutes} minutes${doc.format === 'series' ? ' in all' : ''}`,
    doc.director && `directed by ${doc.director}`
  ].filter(Boolean).join(', ');
  const makers = (doc.makers ?? []).map(makerLabel).filter(Boolean);
  const shortcuts = (doc.shortcuts ?? []).map(shortcutLabel).filter(Boolean);
  return (
    <>
      <h2 id="dialog-title">{doc.title}</h2>
      {facts && <p className="facts">{facts}</p>}
      {doc.description && <p className="summary">{doc.description}</p>}
      {doc.subjects.length > 0 && <p className="facts">About: {doc.subjects.join(', ')}</p>}
      {doc.topics.length > 0 && <p className="facts">Topics: {doc.topics.map(topicLabel).join(', ')}</p>}
      {shortcuts.length > 0 && <p className="facts">Subject: {shortcuts.join(', ')}</p>}
      {makers.length > 0 && <p className="facts">Made by {listText(makers)}</p>}
      <p className="links">
        <a className="button button--primary" href={doc.watch} target="_blank" rel="noopener noreferrer">
          Where to watch in the UK
        </a>
        {doc.wikipedia && (
          <a className="button" href={doc.wikipedia} target="_blank" rel="noopener noreferrer">Read on Wikipedia</a>
        )}
        <a className="button" href={doc.wikidata} target="_blank" rel="noopener noreferrer">Wikidata record</a>
        <CopyLink />
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
          {doc.kind === 'archive' ? <ArchiveDetail key={doc.id} doc={doc} /> : <ModernDetail key={doc.id} doc={doc} />}
        </div>
      )}
    </dialog>
  );
}
