// Archive.org fields arrive as a string or an array of strings
export const first = value => (Array.isArray(value) ? value[0] : value) ?? '';
export const asList = value => (Array.isArray(value) ? value : value ? [value] : []);

// Descriptions hold HTML. Parse to plain text without running or inserting any of it.
export function toPlainText(html) {
  const source = String(html || '');
  if (!source) return '';
  try {
    const doc = new DOMParser().parseFromString(source, 'text/html');
    doc.querySelectorAll('script, style, noscript, template').forEach(node => node.remove());
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  } catch {
    return source.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

// Links from API data go into href attributes. Allow https only, so a bad record never becomes a script link.
export function safeUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export function shorten(text, max = 320) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}
