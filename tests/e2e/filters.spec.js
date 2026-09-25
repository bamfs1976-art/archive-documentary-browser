import { readFileSync } from 'node:fs';
import { expect, test as base } from '@playwright/test';

// Subject shortcuts and the Made by filter. Uses the recorded responses and the committed snapshot.
const test = base.extend({ live: [false, { option: true }] });
const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const thumbnail = readFileSync(new URL('./fixtures/thumbnail.jpg', import.meta.url));
const snapshot = JSON.parse(readFileSync(new URL('../../src/data/modern.json', import.meta.url), 'utf8')).docs;

test.beforeEach(async ({ page, live }) => {
  test.skip(live, 'Recorded responses only');
  await page.route('https://archive.org/services/img/**', route => route.fulfill({ contentType: 'image/jpeg', body: thumbnail }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
});

test('Made by narrows modern documentaries to a broadcaster and the panel says so', async ({ page }) => {
  const bbc = snapshot.filter(d => d.tags?.makers?.includes('bbc'));
  test.skip(!bbc.length, 'Snapshot has no BBC titles');
  await page.goto('/?collection=modern');
  await page.getByRole('combobox', { name: 'Made by' }).selectOption('bbc');
  await expect(page).toHaveURL(/\?collection=modern&maker=bbc$/);
  await expect(page.locator('#results').getByRole('status')).toHaveText(`${bbc.length} documentaries found`);
  await page.locator('#results').getByRole('listitem').first().getByRole('button').click();
  await expect(page.getByRole('dialog').getByText(/^Made by .*BBC/)).toBeVisible();
});

test('the Made by menu is for modern documentaries only', async ({ page }) => {
  await page.route('https://archive.org/advancedsearch.php**', route => route.fulfill({ contentType: 'application/json', body: fixture('archive.json') }));
  await page.goto('/?maker=bbc');
  await expect(page.getByRole('combobox', { name: 'Made by' })).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

test('a subject shortcut filters modern documentaries and can be switched off', async ({ page }) => {
  const spanish = snapshot.filter(d => d.tags?.shortcuts?.includes('spanish-civil-war'));
  test.skip(!spanish.length, 'Snapshot has no Spanish Civil War titles');
  await page.goto('/?collection=modern');
  const subjects = page.getByRole('group', { name: 'Subject' });
  const button = subjects.getByRole('button', { name: 'Spanish Civil War' });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/subject=spanish-civil-war/);
  const count = Number((await page.locator('#results').getByRole('status').innerText()).match(/\d+/)[0]);
  expect(count).toBeGreaterThanOrEqual(spanish.length);
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(page).toHaveURL(/\?collection=modern$/);
});

test('a subject shortcut on archive films sends a narrower query', async ({ page }) => {
  const queries = [];
  await page.route('https://archive.org/advancedsearch.php**', route => {
    queries.push(new URL(route.request().url()).searchParams.get('q'));
    return route.fulfill({ contentType: 'application/json', body: fixture('archive.json') });
  });
  await page.goto('/');
  await page.getByRole('group', { name: 'Subject' }).getByRole('button', { name: 'British monarchy' }).click();
  await expect(page).toHaveURL(/\?subject=monarchy$/);
  await expect.poll(() => queries.at(-1)).toContain('coronation');
});

test('an empty subject explains why', async ({ page }) => {
  await page.route('https://archive.org/advancedsearch.php**', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ response: { numFound: 0, docs: [] } }) }));
  await page.goto('/?subject=english-civil-war');
  await expect(page.getByText('Few films on this subject exist in this collection.')).toBeVisible();
});
