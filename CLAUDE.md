# CLAUDE.md

Standards and decisions for Documentary Browser. Read this before changing anything.

## What the app is

A React 18 and Vite 5 single-page app with two collections behind one switch.

- Archive films: documentaries, newsreels and information films from the Internet Archive advanced search API. They play in the embedded Archive.org player.
- Modern documentaries: documentary films (Wikidata Q93204) released since 1980 with at least four Wikipedia sitelinks. Each links to JustWatch UK, Wikipedia and Wikidata.

Three topics: History and war, Society and culture, Wales and Britain.

## Layout

- `src/services/archive.js` builds the Archive.org query, parses results and runtimes.
- `src/services/wikidataQuery.js` holds the SPARQL query and row parser. It must run in Node and the browser.
- `src/services/wikidata.js` loads the snapshot, falls back to a live fetch, filters and sorts modern titles.
- `scripts/fetch-modern.mjs` saves the snapshot to `src/data/modern.json` before each build. Topics are left out of the file and worked out on load.
- `src/services/topics.js` defines topics and classifies modern titles.
- `src/services/text.js` turns HTML into plain text and shortens text.
- `src/services/storage.js` wraps localStorage with an in-memory fallback.
- `src/hooks/` fetches and pages data. `src/components/` renders cards and the details dialog.
- `src/App.jsx` holds UI state. `src/index.css` holds all styles and colour tokens.

## Fixed decisions (ask Anthony before changing)

- React and Vite. No other framework.
- No API keys and no paid services. No TMDB.
- Hosted on Netlify, deployed from GitHub repo `bamfs1976-art/archive-documentary-browser`.
- GitHub work goes through the GitHub connector, since the gh CLI is not available in cloud sessions.
- Palette: teal `#0F5C5C`, off-white `#F7F6F2`, Welsh red `#C8102E`, ink `#1B2426`, muted `#4E5B5A`.
- Fonts: Archivo (display), Source Serif 4 (body).
- Minimal dependencies. Justify each new one to Anthony before adding it.
- Approved dev dependencies: Vitest, @playwright/test, happy-dom.
- The Wikidata snapshot `src/data/modern.json` is committed to the repo. The build refreshes it and keeps the committed copy if Wikidata fails. A failed fetch warns and never fails the build.
- The Playwright smoke test uses recorded API responses by default. A separate script runs it against the live APIs.

## Agreed for after Phase 1 (decided 25 September 2026)

- Modern documentaries widen to include documentary TV series and miniseries, not only films.
- The 1980 cut-off goes. Classics such as The World at War can appear.
- Add a "Made by" filter for BBC, PBS and History, using Wikidata original broadcaster (P449) and production company (P272). Sub-channels such as BBC Two and BBC Four count as BBC.
- Add subject shortcuts for American Civil War, English Civil War, Spanish Civil War and British monarchy, using main subject (P921) with keywords as a fallback. British monarchy must cover the Normans, Plantagenets, Tudors and Stuarts.
- Broadcaster uploads (BBC, PBS, History channel TV) stay out of Archive films. They are usually copyrighted and get taken down.
- Look up every Wikidata item ID live before using it. Never hard-code an ID from memory.
- Phase 1 finishes first.

## Archive.org query rules (from live sampling, 25 September 2026)

- Never trust `newsandpublicaffairs` as a whole. It holds 3.4 million items, mostly community access TV, raw news footage and militant propaganda from `iraq_war` and `iraq_middleeast`.
- Trusted in full: `prelinger`, `universal_newsreels`. Trusted with a documentary or newsreel tag: `usgovfilms`, `feature_films`, `moviesandfilms`, `silent_films`, `short_films`.
- Hide single items through `src/data/blocklist.json`: an array of `{ "id": "identifier", "reason": "why" }`.
- In cloud sessions Node's fetch ignores the proxy. Prefix scripts that call the APIs with `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`.
- Sandbox note: headless Chromium in cloud sessions rejects the proxy's HTTPS, so `npm run test:live` only works on a normal machine. Check live behaviour on the Netlify preview.

## Accessibility

- WCAG 2.2 AA minimum. Lighthouse accessibility score of 95 or higher.
- Check contrast for every new colour pairing: 4.5:1 for text, 3:1 for large text, focus rings and component edges.
- Everything works by keyboard and shows a visible focus ring. Watch for `overflow: hidden` parents clipping outlines.
- Touch targets at least 44px.

Checked pairings:

| Pair | Ratio |
| --- | --- |
| Ink on off-white | 14.6:1 |
| Muted on off-white | 6.5:1 |
| Teal on off-white | 7.2:1 |
| White on Welsh red | 5.9:1 |
| White on red hover `#A30D25` | 8.0:1 |
| Red focus ring on off-white | 5.4:1 |
| Teal on teal-soft `#E1EEEC` | 6.5:1 |
| Muted on white | 7.1:1 |

## Security

- Never use `dangerouslySetInnerHTML` with API data. Convert HTML to text with `toPlainText`.
- Only render `https:` URLs from API data in `href` or `src`.
- Keep the Content Security Policy in `netlify.toml` in step with every new external host.

## Interface copy

- British English.
- No em dashes.
- No comma before "and" or "or" in lists.

## Commands

- `npm run dev` starts the dev server on port 3000.
- `npm run build` refreshes the Wikidata snapshot, then builds to `dist`.
- `npm run build:app` builds without contacting Wikidata.
- `npm run fetch-modern` refreshes `src/data/modern.json` on its own.
- `npm run record-fixtures` re-records the smoke test fixtures from the live APIs, trimmed.
- `npm test` runs the Vitest unit tests in `tests/unit` (happy-dom environment).
- `npm run test:e2e` runs the Playwright smoke test in `tests/e2e` with real responses recorded in `tests/e2e/fixtures`.
- `npm run test:live` runs the same smoke test against the live APIs.
- `vite preview` serves the CSP from `netlify.toml`, so the smoke test runs under the production policy.

## Version pins

- Vitest stays on 3.x while the app is on Vite 5. Vitest 4 and later need Vite 6 or newer.
- `@playwright/test` is pinned to an exact version so it matches the installed Chromium build.

## How to work

- Run `npm run build` and all tests before every commit.
- Commit after each completed item with a clear message. One feature branch and one pull request per phase.
- When an API behaves differently from what the code or brief expects, report what you found and propose a fix. Do not guess.
- At the end of each phase, report what changed, what you tested, what you could not test and any risks.
- Keep `README.md` and this file up to date as the app changes.

## External services

- Archive.org: `archive.org/advancedsearch.php`, thumbnails from `archive.org/services/img/{id}` (redirects to `*.archive.org`), player at `archive.org/embed/{id}`.
- Wikidata: `query.wikidata.org/sparql`. Send a descriptive User-Agent header from build scripts, as Wikimedia policy asks.
- JustWatch UK: search links only, no API.
