// localStorage with an in-memory fallback for private windows and sandboxes
const memory = new Map();

export function readCache(key, maxAgeMs) {
  let raw = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    raw = memory.get(key) ?? null;
  }
  if (!raw) return null;
  try {
    const { savedAt, data } = JSON.parse(raw);
    return Date.now() - savedAt < maxAgeMs ? data : null;
  } catch {
    return null;
  }
}

export function writeCache(key, data) {
  const raw = JSON.stringify({ savedAt: Date.now(), data });
  memory.set(key, raw);
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    // Storage full or blocked: the in-memory copy still serves this session
  }
}
