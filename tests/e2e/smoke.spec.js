import { readFileSync } from 'node:fs';
import { expect, test as base } from '@playwright/test';

// `npm run test:e2e` answers every API call from tests/e2e/fixtures. `npm run test:live` uses the real APIs.
const test = base.extend({ live: [false, { option: true }] });
const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const thumbnail = readFileSync(new URL('../../public/icon-180.png', import.meta.url));

test.beforeEach(async ({ page, live }) => {
  if (live) return;
  await page.route('https://archive.org/advancedsearch.php**', route =>
    route.fulfill({ contentType: 'application/json', body: fixture('archive.json') }));
  await page.route('https://archive.org/services/img/**', route =>
    route.fulfill({ contentType: 'image/png', body: thumbnail }));
  await page.route('https://query.wikidata.org/**', route =>
    route.fulfill({ contentType: 'application/sparql-results+json', body: fixture('wikidata.json') }));
  // Keep the run offline and fast. System fonts stand in for the web fonts.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
});

test('browse both collections and use the details panel by keyboard', async ({ page, live }) => {
  const cspErrors = [];
  page.on('console', msg => {
    if (/Content Security Policy/i.test(msg.text())) cspErrors.push(msg.text());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Documentary Browser' })).toBeVisible();

  // Archive films load first
  const results = page.locator('#results');
  await expect(results.getByRole('status')).toHaveText(/\d[\d,]* documentar(y|ies) found/, { timeout: live ? 60_000 : 10_000 });
  await expect(results.getByRole('listitem').first()).toBeVisible();

  // Switch collection
  const modern = page.getByRole('button', { name: /Modern documentaries/ });
  await modern.click();
  await expect(modern).toHaveAttribute('aria-pressed', 'true');
  await expect(results.getByRole('status')).toHaveText(/\d[\d,]* documentar(y|ies) found/, { timeout: live ? 75_000 : 10_000 });

  // Pick a topic
  const wales = page.getByRole('group', { name: 'Topic' }).getByRole('button', { name: 'Wales and Britain' });
  await wales.click();
  await expect(wales).toHaveAttribute('aria-pressed', 'true');
  const firstCard = results.getByRole('listitem').first().getByRole('button');
  await expect(firstCard).toBeVisible();
  await expect(firstCard).toContainText('Wales and Britain');

  // Open the details panel from the keyboard
  const title = (await firstCard.locator('.title-card__title').innerText()).trim();
  await firstCard.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(title);
  await expect(dialog.getByRole('link', { name: 'Where to watch in the UK' })).toHaveAttribute('href', /^https:\/\/www\.justwatch\.com\/uk\/search\?q=/);
  await expect(dialog.getByRole('button', { name: 'Close details' })).toBeFocused();

  // Escape closes the panel and focus returns to the card
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(firstCard).toBeFocused();

  expect(cspErrors).toEqual([]);
});
