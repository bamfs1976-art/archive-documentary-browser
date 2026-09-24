// Archive.org fields arrive as a string or an array of strings
export const first = value => (Array.isArray(value) ? value[0] : value) ?? '';
export const asList = value => (Array.isArray(value) ? value : value ? [value] : []);

// Descriptions hold HTML. Parse to plain text without running or inserting any of it.
export function toPlainText(html) {
  const source = String(html || '');
  if (!source) return '';
  try {
    const doc = new DOMParser().parseFromString(source, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  } catch {
    return source.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

export function shorten(text, max = 320) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}
