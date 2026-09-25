// Runs before `vite build`. Fetches modern documentaries from Wikidata and saves src/data/modern.json.
// When Wikidata is slow, down or returns too little, it keeps the committed snapshot and warns.
// It never fails the build.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENDPOINT, QUERY, parseBindings } from '../src/services/wikidataQuery.js';

export const SNAPSHOT = fileURLToPath(new URL('../src/data/modern.json', import.meta.url));
export const TIMEOUT_MS = 90_000;
// A healthy result holds well over this. Fewer means a partial or broken reply.
export const MIN_DOCS = 200;
// Wikimedia asks scripted clients to identify themselves
export const USER_AGENT =
  'DocumentaryBrowser/1.0 (https://github.com/bamfs1976-art/archive-documentary-browser) build-script';

function describeSnapshot(file) {
  try {
    const { generatedAt, docs } = JSON.parse(readFileSync(file, 'utf8'));
    return `${docs.length} titles from ${generatedAt}`;
  } catch {
    return null;
  }
}

export async function refreshSnapshot({ fetchImpl = fetch, file = SNAPSHOT, log = console, timeoutMs = TIMEOUT_MS, now = () => new Date() } = {}) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Accept: 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT
      },
      body: new URLSearchParams({ query: QUERY, format: 'json' }).toString()
    });
    if (!response.ok) throw new Error(`Wikidata replied with status ${response.status}`);
    // Topics are worked out when the app loads the snapshot, so rule changes never need a refetch
    const docs = parseBindings(await response.json()).map(({ topics, ...doc }) => doc);
    if (docs.length < MIN_DOCS) throw new Error(`only ${docs.length} titles came back, expected at least ${MIN_DOCS}`);

    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ generatedAt: now().toISOString(), count: docs.length, docs }) + '\n');
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    log.log(`[fetch-modern] Saved ${docs.length} titles in ${seconds}s`);
    return { updated: true, count: docs.length };
  } catch (error) {
    const reason = error.name === 'AbortError' ? `no reply within ${timeoutMs / 1000}s` : error.message;
    const kept = existsSync(file) && describeSnapshot(file);
    log.warn(`[fetch-modern] WARNING: Wikidata refresh failed (${reason}).`);
    log.warn(kept
      ? `[fetch-modern] Keeping the existing snapshot: ${kept}.`
      : '[fetch-modern] No usable snapshot exists. The app will fetch from Wikidata live, which is slow.');
    return { updated: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await refreshSnapshot();
}
