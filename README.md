# Documentary Browser

A React and Vite app for finding documentaries. Two collections sit side by side.

Archive films: free documentaries, newsreels and information films from the Internet Archive. Watch them in the browser.

Modern documentaries: notable documentary films and series from any year, drawn from Wikidata. Each one links to JustWatch UK to show where to stream it.

No API keys. No accounts. No server.

## Sharing

Every view has its own address. The collection, topic, sort order, search and open documentary all live in the query string, for example `?collection=modern&topic=history&q=coal&doc=Q123`. Back and Forward step through what you did. Copy link in the details panel copies the address of the open documentary. A shared archive link only opens films the app would list anyway.

## Topics

History and war, Society and culture, Wales and Britain. Archive films filter at the source through Archive.org subject tags. Modern documentaries filter by subject, description and country of origin.

## Run locally

Needs Node.js 18 or newer.

```
npm install
npm run dev
```

Opens at http://localhost:3000

## Build

```
npm run build
```

Output lands in `dist`.

The build first runs `scripts/fetch-modern.mjs`, which saves modern documentaries from Wikidata to `src/data/modern.json`. Commit that file. If Wikidata is slow or down during a build, the script keeps the committed snapshot, prints a warning and lets the build carry on. Use `npm run build:app` to build without contacting Wikidata.

## Test

```
npm test              # unit tests (Vitest)
npm run test:e2e      # browser smoke test with recorded API responses
npm run test:live     # the same smoke test against the live APIs
npm run record-fixtures  # re-record the smoke test responses from the live APIs
```

The smoke test runs the production build under the same Content Security Policy as `netlify.toml`, and fails if the policy blocks anything. On a new machine, run `npx playwright install chromium` once first.

## Deploy on Netlify

1. Push this repo to GitHub.
2. In Netlify, choose Add new site, then Import an existing project, then pick this repo.
3. Netlify reads `netlify.toml`: build command `npm run build`, publish folder `dist`.

Netlify Drop does not suit the source files. Drop the built `dist` folder instead if you prefer drag and drop.

## Data sources

- Internet Archive advanced search and embed player: https://archive.org
- Wikidata query service: https://query.wikidata.org
- JustWatch UK search links: https://www.justwatch.com/uk

Modern titles load instantly from the snapshot saved at build time. Only when no snapshot exists does the app query Wikidata live, which takes up to 30 seconds, and it caches that result in the browser for seven days.

## Credits

Based on the idea of archive-movie-browser by amponce, MIT licence.

## Licence

MIT
