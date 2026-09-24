# Documentary Browser

A React and Vite app for finding documentaries. Two collections sit side by side.

Archive films: free documentaries, newsreels and information films from the Internet Archive. Watch them in the browser.

Modern documentaries: notable documentaries released since 1980, drawn from Wikidata. Each one links to JustWatch UK to show where to stream it.

No API keys. No accounts. No server.

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

## Deploy on Netlify

1. Push this repo to GitHub.
2. In Netlify, choose Add new site, then Import an existing project, then pick this repo.
3. Netlify reads `netlify.toml`: build command `npm run build`, publish folder `dist`.

Netlify Drop does not suit the source files. Drop the built `dist` folder instead if you prefer drag and drop.

## Data sources

- Internet Archive advanced search and embed player: https://archive.org
- Wikidata query service: https://query.wikidata.org
- JustWatch UK search links: https://www.justwatch.com/uk

Modern results cache in the browser for seven days. Wikidata slows at busy times, so the first load takes up to 30 seconds.

## Credits

Based on the idea of archive-movie-browser by amponce, MIT licence.

## Licence

MIT
