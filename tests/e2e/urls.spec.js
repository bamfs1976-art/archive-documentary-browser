import { readFileSync } from 'node:fs';
import { expect, test as base } from '@playwright/test';

// Shareable addresses, deep links and the Back and Forward buttons. Uses the same recorded responses as smoke.spec.js.
const test = base.extend({ live: [false, { option: true }] });
const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const thumbnail = readFileSync(new URL('./fixtures/thumbnail.jpg', import.meta.url));
const modernDocs = JSON.parse(readFileSync(new URL('../../src/data/modern.json', import.meta.url), 'utf8')).docs;
const archiveDocs = JSON.parse(fixture('archive.json')).response.docs;

test.beforeEach(async ({ page, live }) => {
  test.skip(live, 'Recorded responses only');
  await page.route('https://archive.org/advancedsearch.php**', route =>
    route.fulfill({ contentType: 'application/json', body: fixture('archive.json') }));
  await page.route('https://archive.org/services/img/**', route =>
    route.fulfill({ contentType: 'image/jpeg', body: thumbnail }));
  await page.route('https://query.wikidata.org/**', route =>
    route.fulfill({ contentType: 'application/sparql-results+json', body: fixture('wikidata.json') }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
});

const pressed = (page, name) => page.getByRole('button', { name, exact: false });
const params = page => new URL(page.url()).searchParams;

test('a shared link opens the right view and documentary', async ({ page }) => {
  const doc = modernDocs[0];
  await page.goto(`/?collection=modern&sort=title&doc=${doc.id}`);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(doc.title);
  await expect(page).toHaveTitle(`${doc.title} | Documentary Browser`);
  await expect(pressed(page, /Modern documentaries/)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: 'Sort' })).toHaveValue('title');

  // Closing a panel that came from a link drops it from the address and stays on this page
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(params(page).get('doc')).toBeNull();
  expect(params(page).get('collection')).toBe('modern');
  await expect(page).toHaveTitle('Documentary Browser');
});

test('a shared archive link opens its film', async ({ page }) => {
  const film = archiveDocs[3];
  await page.goto(`/?doc=${film.identifier}`);
  await expect(page.getByRole('dialog').getByRole('heading', { level: 2 })).toHaveText([].concat(film.title)[0]);
});

test('every choice lands in the address and Back and Forward replay them', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#results').getByRole('listitem').first()).toBeVisible();
  expect(page.url()).not.toContain('?');

  await page.getByRole('group', { name: 'Topic' }).getByRole('button', { name: 'History and war' }).click();
  await expect(page).toHaveURL(/\?topic=history$/);
  await pressed(page, /Modern documentaries/).click();
  await expect(page).toHaveURL(/\?collection=modern&topic=history$/);
  await page.getByRole('searchbox', { name: 'Search documentaries' }).fill('war');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/\?collection=modern&topic=history&q=war$/);

  await page.goBack();
  await expect(page).toHaveURL(/\?collection=modern&topic=history$/);
  await expect(page.getByRole('searchbox', { name: 'Search documentaries' })).toHaveValue('');
  await page.goBack();
  await expect(page).toHaveURL(/\?topic=history$/);
  await expect(pressed(page, /Archive films/)).toHaveAttribute('aria-pressed', 'true');
  await page.goForward();
  await expect(pressed(page, /Modern documentaries/)).toHaveAttribute('aria-pressed', 'true');
});

test('Back closes a panel opened from the grid and Forward reopens it', async ({ page }) => {
  await page.goto('/?collection=modern');
  const card = page.locator('#results').getByRole('listitem').first().getByRole('button');
  const title = (await card.locator('.title-card__title').innerText()).trim();
  await card.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(title);
  expect(params(page).get('doc')).toMatch(/^Q\d+$/);

  await page.goBack();
  await expect(dialog).toBeHidden();
  await page.goForward();
  await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(title);

  // Closing steps back rather than piling up history
  await dialog.getByRole('button', { name: 'Close details' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\?collection=modern$/);
});

test('a broken or unknown link says so and still shows the page', async ({ page }) => {
  await page.goto('/?collection=modern&doc=Q1&topic=nonsense');
  await expect(page.getByText('That link points to a documentary we could not find.')).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page).toHaveURL(/\?collection=modern$/);
});

test('Copy link copies the address of the open documentary', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const doc = modernDocs[1];
  await page.goto(`/?collection=modern&doc=${doc.id}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByRole('dialog').getByText('Link copied')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
});

test('a shared archive link to a film beyond the first page is looked up on its own', async ({ page }) => {
  const lookups = [];
  await page.route('https://archive.org/advancedsearch.php**', route => {
    const q = new URL(route.request().url()).searchParams.get('q');
    if (!q.includes('identifier:"')) return route.fulfill({ contentType: 'application/json', body: fixture('archive.json') });
    lookups.push(q);
    const docs = q.includes('identifier:"Deep_Film_1950"') ? [{ identifier: 'Deep_Film_1950', title: 'Deep Film', year: '1950' }] : [];
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ response: { numFound: docs.length, docs } }) });
  });

  await page.goto('/?doc=Deep_Film_1950');
  await expect(page.getByRole('dialog').getByRole('heading', { level: 2 })).toHaveText('Deep Film');
  expect(lookups[0]).toMatch(/^\(mediatype:movies AND .* AND identifier:"Deep_Film_1950"$/);

  // A film outside the trusted collections is never shown, even from a link
  await page.goto('/?doc=untrusted_upload');
  await expect(page.getByText('That link points to a documentary we could not find.')).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
});
