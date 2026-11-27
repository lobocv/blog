import type { ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { startEditor } from './start-editor.ts';

const port = 4450;
const url = `http://127.0.0.1:${port}/`;
const link = 'https://www.lobocv.com/posts/live/?utm_source=linkedin&utm_medium=social';
let editor: ChildProcess;
let site: Server;
let root: string;

const shareFile = (name: string) => join(root, 'writing/share/live', name);
const shareJson = async () => JSON.parse(await readFile(shareFile('share.json'), 'utf8'));

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // A throwaway repo with one draft and one published post.
  root = await mkdtemp(join(tmpdir(), 'editor-share-'));
  const posts = {
    draft: '---\ntitle: A draft\ndraft: true\n---\nText.\n',
    live: '---\ntitle: "Live post"\nsummary: "What it says."\ndraft: false\ndate: 2026-11-24\ncategories: ["Golang"]\n---\nText.\n',
  };
  for (const [slug, text] of Object.entries(posts)) {
    await mkdir(join(root, 'src/content/posts', slug), { recursive: true });
    await writeFile(join(root, 'src/content/posts', slug, 'index.md'), text);
  }
  // The live site, as pre-flight sees it, so the test never reaches the real one.
  site = createServer((req, res) => {
    if (req.url === '/posts/live/') {
      res.end(
        '<meta property="og:title" content="Live post"><meta property="og:description" content="What it says.">' +
          '<meta property="og:image" content="/og/live.png"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@x">',
      );
    } else if (req.url === '/og/live.png') res.writeHead(200, { 'content-type': 'image/png' }).end('png');
    else res.writeHead(404).end();
  });
  await new Promise<void>((r) => site.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${(site.address() as AddressInfo).port}`;
  editor = await startEditor(root, port, '--no-preview', '--check-origin', origin);
});

test.afterEach(() => {
  editor?.kill();
  site?.closeAllConnections();
  site?.close();
});

test('shares a published post: type, check, copy and record the posted URL', async ({ page }) => {
  await page.goto(url);
  // Drafts can't be shared: S does nothing on one.
  await expect(page.getByRole('option')).toHaveText([/A draft/, /Live post/]);
  await page.keyboard.press('s');
  await expect(page).toHaveURL(url);
  await page.keyboard.press('j');
  await page.keyboard.press('s');
  await expect(page).toHaveURL(`${url}?share=live`);

  await expect(page.getByRole('heading', { name: 'Live post' })).toBeVisible();
  await expect(page.getByText('Live page and preview card look right')).toBeVisible();
  await expect(page.getByRole('button', { name: /^LinkedIn/ })).toHaveAttribute('aria-pressed', 'true');

  // Typing saves the text and rewrites the ready-to-paste file.
  const text = page.getByLabel('LinkedIn post text');
  await text.click();
  await page.keyboard.type('Errors in Go can carry more than a message.');
  await expect
    .poll(() => readFile(shareFile('linkedin.txt'), 'utf8').catch(() => ''))
    .toBe(`Errors in Go can carry more than a message.\n\n${link}\n\n#Golang #Go\n`);
  await expect(page.getByLabel('LinkedIn preview')).toContainText('Errors in Go can carry more than a message.');

  // Two hashtags is under LinkedIn's three: the check says so until a third is added.
  await expect(page.getByLabel('Failing checks')).toContainText('2 hashtags');
  await page.getByLabel('Add a hashtag').fill('#Software Engineering');
  await page.getByLabel('Add a hashtag').press('Enter');
  await expect(page.getByLabel('Failing checks')).toHaveCount(0);
  await expect.poll(async () => (await shareJson()).networks.linkedin.hashtags).toEqual(['Golang', 'Go', 'SoftwareEngineering']);

  // A banned word and an em-dash are flagged as he types.
  await text.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' We leverage them — a lot.');
  await expect(page.getByLabel('Failing checks')).toContainText('Reads as AI-written: "leverage"');
  await expect(page.getByLabel('Failing checks')).toContainText('1 em-dash');
  for (let i = 0; i < ' We leverage them — a lot.'.length; i++) await page.keyboard.press('Backspace');

  // A hook that runs well past the fold is flagged; the short one wasn't.
  await page.keyboard.type(' It can carry the operation, the IDs involved, what the caller should do next, and whether retrying could ever help, which is a lot to say before anyone taps to read more.'.repeat(2));
  await expect(page.getByLabel('Failing checks')).toContainText('The first paragraph runs past the fold');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Errors in Go can carry more than a message.\n\nHere is how.');
  await expect(page.getByLabel('Failing checks')).toHaveCount(0);

  // C copies (after leaving the text box), and the copied text becomes a version.
  await page.keyboard.press('Escape');
  await page.keyboard.press('c');
  await expect(page.getByText('Copied', { exact: true })).toBeVisible();
  const pasted = `Errors in Go can carry more than a message.\n\nHere is how.\n\n${link}\n\n#Golang #Go #SoftwareEngineering`;
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(pasted);
  await expect.poll(async () => (await shareJson()).networks.linkedin).toMatchObject({ status: 'ready', versions: [{ text: 'Errors in Go can carry more than a message.\n\nHere is how.' }] });
  expect(await readFile(shareFile('linkedin.txt'), 'utf8')).toBe(`${pasted}\n`);

  // Restore brings back the copied version and keeps the newer text as a version.
  await text.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' Later.');
  await page.keyboard.press('Alt+KeyV');
  await page.getByRole('menuitem', { name: 'Restore' }).last().click();
  await expect(text).toHaveText('Errors in Go can carry more than a message.Here is how.');
  await expect.poll(async () => (await shareJson()).networks.linkedin.versions.map((v: { text: string }) => v.text)).toEqual([
    'Errors in Go can carry more than a message.\n\nHere is how.',
    'Errors in Go can carry more than a message.\n\nHere is how. Later.',
  ]);

  // Recording the posted URL.
  await page.getByLabel('Posted URL').fill('https://www.linkedin.com/feed/update/urn:li:activity:1/');
  await page.getByLabel('Posted URL').press('Enter');
  await expect(page.getByText(/^Posted/)).toBeVisible();
  await expect.poll(async () => (await shareJson()).networks.linkedin).toMatchObject({
    status: 'posted',
    posted: { url: 'https://www.linkedin.com/feed/update/urn:li:activity:1/', text: pasted },
  });

  // Esc goes back to the posts page.
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(url);
});
