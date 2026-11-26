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
  process.env.FAKE_CLAUDE_SUGGEST = join(root, 'suggest.json');
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

test('Claude suggests an edit; tweaking and accepting it changes the text, and ⌘Z undoes it', async ({ page }) => {
  await writeFile(postPath('first'), '---\ntitle: First draft\ndraft: true\n---\nIt took incredible amounts of work.\n');
  await writeFile(join(root, 'suggest.json'), JSON.stringify({ find: 'incredible amounts of', replace: 'a lot of', reason: 'Plainer.' }));
  await page.goto(`${url}?post=first`);
  const source = page.getByLabel('Post source');
  await source.getByText('It took').click();
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByLabel('Comment').fill('too showy?');
  await page.getByLabel('Comment').press('Enter');

  // The suggestion shows in the thread as a change, with the words it replaces struck through in the text.
  const margin = page.getByRole('complementary', { name: 'Threads' }).first();
  await expect(margin.locator('.suggestion')).toHaveText('incredible amounts of a lot of');
  await expect(source.locator('.cm-del')).toHaveText('incredible amounts of');

  // ⌥T opens Calvin's version of it; Enter applies that instead.
  await page.keyboard.press('Alt+t');
  await page.getByLabel('Your version').fill('lots of');
  await page.getByLabel('Your version').press('Enter');
  await expect(source).toContainText('It took lots of work.');
  await expect.poll(() => readFile(postPath('first'), 'utf8')).toContain('It took lots of work.');
  await expect(margin.getByText('Accepted')).toBeVisible();

  // Applied like typing, so ⌘Z undoes it.
  await source.click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(source).toContainText('It took incredible amounts of work.');
});

test('reloads outside edits, merges them with unsaved typing, and asks when they clash', async ({ page }) => {
  const base = '---\ntitle: First draft\ndraft: true\n---\nOne.\n\nTwo.\n';
  await writeFile(postPath('first'), base);
  // Outside edits arrive on the event stream, so wait for it to open.
  const stream = page.waitForResponse((r) => r.url().includes('/events'));
  await page.goto(`${url}?post=first`);
  await stream;
  const source = page.getByLabel('Post source');
  await expect(source).toContainText('Two.');
  const outside = (text: string) => writeFile(postPath('first'), text);

  // No typing: the editor takes the new text.
  await outside(base.replace('One.', 'One, from Zed.'));
  await expect(source).toContainText('One, from Zed.');

  // Unsaved typing in another paragraph: both survive, and the file ends up with both.
  await source.getByText('Two.').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Typed.');
  await outside(base.replace('One.', 'One, again.'));
  await expect(source).toContainText('One, again.');
  await expect(source).toContainText('Two. Typed.');
  await expect.poll(() => readFile(postPath('first'), 'utf8')).toBe(base.replace('One.', 'One, again.').replace('Two.', 'Two. Typed.'));

  // Typing in the same place as the outside edit: Calvin chooses.
  await page.keyboard.type(' More.');
  await outside(base.replace('One.', 'One, again.').replace('Two.', 'Two, from Zed.'));
  await expect(page.getByRole('alert')).toContainText('changed outside the editor');
  await page.getByRole('button', { name: 'Keep mine' }).click();
  await expect.poll(() => readFile(postPath('first'), 'utf8')).toContain('Two. Typed. More.');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
