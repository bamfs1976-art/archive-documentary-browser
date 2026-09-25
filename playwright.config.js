import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  retries: 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure'
  },
  projects: [
    // Default: every API call answered from tests/e2e/fixtures
    { name: 'recorded', timeout: 30_000, use: { live: false } },
    // Real Archive.org and Wikidata, which slow down at busy times
    { name: 'live', timeout: 120_000, use: { live: true } }
  ],
  webServer: {
    // build:app skips the Wikidata refresh, so test runs stay offline
    command: `npm run build:app && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
