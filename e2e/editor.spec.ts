import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { startEditor } from './start-editor.ts';

const port = 4430;
const url = `http://127.0.0.1:${port}/`;
let editor: ChildProcess;
let root: string;

const postPath = (slug: string) => join(root, 'src/content/posts', slug, 'index.md');

test.beforeEach(async () => {
  // A throwaway repo with two drafts and a published post.
  root = await mkdtemp(join(tmpdir(), 'editor-e2e-'));
  // `first` was edited most recently, so it's listed first.
  const posts = { first: ['First draft', true, 2], second: ['Second draft', true, 1], live: ['Live post', false, 3] } as const;
  for (const [slug, [title, draft, day]] of Object.entries(posts)) {
    await mkdir(join(root, 'src/content/posts', slug), { recursive: true });
    await writeFile(postPath(slug), `---\ntitle: ${title}\ndraft: ${draft}\n---\nFirst line.\n`);
    const edited = new Date(2026, 10, day);
    await utimes(postPath(slug), edited, edited);
  }
  // No Astro in this repo, so no preview. Claude is a fake replaying a recorded reply, slowly
  // enough to stop it part way.
  process.env.FAKE_CLAUDE_STREAM = join(import.meta.dirname, '../editor/infra/testdata/reply.jsonl');
  process.env.FAKE_CLAUDE_DELAY = '150';
  editor = await startEditor(root, port, '--no-preview', '--claude', join(import.meta.dirname, '../editor/infra/testdata/fake-claude.mjs'));
});

test.afterEach(() => {
  editor?.kill();
});

test('opens a draft from the drafts page, and typing saves it', async ({ page }) => {
  await page.goto(url);
  await expect(page.getByRole('option')).toHaveText([/First draft/, /Second draft/]);
  await expect(page.getByText('Live post')).toHaveCount(0);

  await page.keyboard.press('j');
  await page.keyboard.press('Enter');

  const source = page.getByLabel('Post source');
  await expect(source).toContainText('title: Second draft');
  await expect(page.getByText('2 words')).toBeVisible();

  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('Second line here.');

  await expect(page.getByText('5 words')).toBeVisible();
  await expect
    .poll(() => readFile(postPath('second'), 'utf8'))
    .toBe('---\ntitle: Second draft\ndraft: true\n---\nFirst line.\nSecond line here.');

  await page.keyboard.press('Alt+o');
  await expect(page.getByRole('option')).toHaveCount(2);
  expect(await readFile(postPath('second'), 'utf8')).not.toContain('ø');
});

test('deletes a draft after confirming, moving it to .trash', async ({ page }) => {
  await page.goto(url);
  await expect(page.getByRole('option')).toHaveCount(2);

  await page.keyboard.press('Backspace');
  await expect(page.getByText(/Delete this draft\?/)).toBeVisible();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('option')).toHaveText([/Second draft/]);
  expect(existsSync(postPath('first'))).toBe(false);
  expect(existsSync(join(root, '.trash'))).toBe(true);
});

test('comments on a selection, replies, resolves, and shows @@ notes as threads', async ({ page }) => {
  await writeFile(postPath('first'), '---\ntitle: First draft\ndraft: true\n---\nFirst line. @@ too short?\n\nSecond paragraph here.\n');
  await page.goto(`${url}?post=first`);
  const source = page.getByLabel('Post source');
  await expect(source).toContainText('Second paragraph');

  // The note shows in the margin straight away.
  const margin = page.getByRole('complementary', { name: 'Threads' }).first();
  await expect(margin).toContainText('too short?');

  // Select "Second paragraph" and comment on it with ⌘K.
  await source.getByText('Second paragraph here.').click();
  await page.keyboard.press('Home');
  for (let i = 0; i < 'Second paragraph'.length; i++) await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByLabel('Comment').fill('needs a stronger verb');
  await page.getByLabel('Comment').press('Enter');

  await expect(margin).toContainText('needs a stronger verb');
  // Back in the text with the selection dropped, so typing doesn't replace what was commented on.
  await page.keyboard.type('Now ');
  await expect(source).toContainText('Second paragraphNow  here.');
  await page.keyboard.press('ControlOrMeta+z');
  const stored = async () => JSON.parse(await readFile(join(root, 'writing/threads/first.json'), 'utf8').catch(() => '{"threads":[]}')).threads;
  await expect.poll(async () => (await stored())[0]?.anchor).toEqual({ quote: 'Second paragraph', line: 7 });

  // The new thread is selected: reply with ⌥R, then resolve with ⌥D.
  await page.keyboard.press('Alt+r');
  await page.getByLabel('Reply').fill('maybe "argues"');
  await page.getByLabel('Reply').press('Enter');
  await expect.poll(async () => (await stored())[0].messages.length).toBe(2);
  await page.keyboard.press('Alt+d');
  await expect.poll(async () => (await stored())[0].resolved).toBe(true);
  await expect(margin).not.toContainText('needs a stronger verb');
  await expect(page.getByText('1 resolved')).toBeVisible();

  // ⌥P opens the page thread for comments on the whole post.
  await page.keyboard.press('Alt+p');
  await page.getByLabel('Message about the whole page').fill('is the ending clear?');
  await page.getByLabel('Message about the whole page').press('Enter');
  await expect(page.getByRole('complementary', { name: 'Page thread' })).toContainText('is the ending clear?');
  expect(await readFile(postPath('first'), 'utf8')).not.toMatch(/[π∂∑®]/);
});

test('Claude replies in the thread as it writes, and ⌃C stops it', async ({ page }) => {
  await page.goto(`${url}?post=first`);
  const source = page.getByLabel('Post source');
  await source.getByText('First line.').click();
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByLabel('Comment').fill('too plain?');
  await page.getByLabel('Comment').press('Enter');

  // The reply streams into the selected thread, then is saved with it.
  const margin = page.getByRole('complementary', { name: 'Threads' }).first();
  await expect(margin).toContainText('Two short sentences.');
  await expect(page.getByText('Claude is replying')).toBeVisible();
  await expect(margin).toContainText('Two short sentences. Nothing else.');
  await expect(page.getByText('Claude is replying')).toHaveCount(0);
  const stored = async () => JSON.parse(await readFile(join(root, 'writing/threads/first.json'), 'utf8').catch(() => '{"threads":[]}'));
  await expect.poll(async () => (await stored()).threads[0]?.messages.at(-1)).toMatchObject({ author: 'claude', text: 'Two short sentences. Nothing else.' });
  expect((await stored()).session).toBe('00000000-0000-4000-8000-000000000001');

  // Ask again and stop part way: what Claude wrote is kept, marked as stopped.
  await page.keyboard.press('Alt+r');
  await page.getByLabel('Reply').fill('shorter?');
  await page.getByLabel('Reply').press('Enter');
  await expect(page.getByText('Claude is replying')).toBeVisible();
  await expect(margin.locator('.claude-working')).toContainText('Two short sentences.');
  await page.keyboard.press('Control+c');
  await expect.poll(async () => (await stored()).threads[0]?.messages.at(-1)?.text).toMatch(/^Two short sentences\..* \(stopped\)$/);
});
