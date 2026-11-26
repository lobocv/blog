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
/** The tool calls the fake claude makes on its next turn. */
const tools = (calls: { name: string; arguments: object }[]) => writeFile(join(root, 'tools.json'), JSON.stringify(calls));

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
  process.env.FAKE_CLAUDE_TOOLS = join(root, 'tools.json');
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

  // ⌥/ opens the page thread for comments on the whole post.
  await page.keyboard.press('Alt+Slash');
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
  await tools([{ name: 'suggest_edit', arguments: { thread_id: '$thread', find: 'incredible amounts of', replace: 'a lot of', reason: 'Plainer.' } }]);
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

test('⇧C starts a critique that shows its progress, and ⇧A accepts every mechanical fix', async ({ page }) => {
  await writeFile(postPath('first'), '---\ntitle: First draft\ndraft: true\n---\nTeh first line.\n\nThe second  line.\n');
  const suggest = (find: string, replace: string) => ({
    name: 'suggest_edit',
    arguments: { thread_id: '$thread', find, replace, reason: 'Typo.', mechanical: true },
  });
  await tools([
    { name: 'review_progress', arguments: { title: 'Line critique', done: 2, total: 5 } },
    suggest('Teh', 'The'),
    suggest('second  line', 'second line'),
  ]);
  await page.goto(`${url}?post=first`);
  await expect(page.getByLabel('Post source')).toContainText('Teh first line.');

  // In Source the key takes ⌥: ⌥⇧C sends "/critique line" to the page thread.
  await page.getByLabel('Post source').click();
  await page.keyboard.press('Alt+Shift+c');
  const pageThread = page.getByRole('complementary', { name: 'Page thread' });
  await expect(pageThread).toContainText('/critique line');
  await expect(pageThread).toContainText('Line critique · 2 of 5');
  await expect(pageThread.locator('.seg.done')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.locator('.page-summary')).toContainText('Line critique · 2 of 5');

  // Each fix sits in the margin beside its words.
  await expect(page.getByRole('complementary', { name: 'Threads' }).first().locator('.thread')).toHaveCount(2);
  await page.keyboard.press('Alt+Shift+a');
  await expect(page.getByLabel('Post source')).toContainText('The first line.');
  await expect(page.getByLabel('Post source')).toContainText('The second line.');
  await expect.poll(() => readFile(postPath('first'), 'utf8')).toContain('The first line.\n\nThe second line.');
});

test('⌥H shows every shortcut and the last key the editor saw', async ({ page }) => {
  await page.goto(`${url}?post=first`);
  const source = page.getByLabel('Post source');
  await source.click();
  await page.keyboard.press('Alt+j');
  await page.keyboard.press('Alt+h');
  const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(sheet).toContainText('Accept all mechanical fixes');
  await expect(sheet).toContainText('Last key the editor saw: ⌥ H');
  await expect(source).not.toContainText('˙');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await page.getByRole('button', { name: 'Keys' }).click();
  await expect(sheet).toBeVisible();
});

test('the key that opens something closes it, even from a message box', async ({ page }) => {
  await page.goto(`${url}?post=first`);
  const source = page.getByLabel('Post source');
  await source.getByText('First line.').click();
  const pageThread = page.getByRole('complementary', { name: 'Page thread' });

  // ⌥/ opens the page thread and puts the cursor in its box; ⌥/ there closes it, typing nothing.
  await page.keyboard.press('Alt+Slash');
  await expect(page.getByLabel('Message about the whole page')).toBeFocused();
  await page.keyboard.press('Alt+Slash');
  await expect(pageThread).toHaveCount(0);
  // ⌘/ works the same way, and doesn't comment out the line.
  await page.keyboard.press('ControlOrMeta+Slash');
  await expect(pageThread).toBeVisible();
  await page.keyboard.press('ControlOrMeta+Slash');
  await expect(pageThread).toHaveCount(0);
  await expect(source).not.toContainText('<!--');

  // ⌘K opens a comment box on the selection, and ⌘K again closes it.
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByLabel('Comment')).toBeFocused();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByLabel('Comment')).toHaveCount(0);

  // ⌥H toggles the sheet.
  await page.keyboard.press('Alt+h');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await page.keyboard.press('Alt+h');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveCount(0);
  await expect(source).toContainText('First line.');
  expect(await readFile(postPath('first'), 'utf8')).not.toMatch(/[π∂∑®÷˙]/);
});

test('G goes to a section, Z hides the threads, and ⇧N asks Claude to action the notes', async ({ page }) => {
  await writeFile(postPath('first'), '---\ntitle: First draft\ndraft: true\n---\nIntro. @@ punchier?\n\n## One\n\nText.\n\n### One point five\n\n## Two\n\nMore.\n');
  await page.goto(`${url}?post=first`);
  const source = page.getByLabel('Post source');
  await source.getByText('Intro.').click();

  // ⌥G opens on the section in view; J moves down, ↵ goes there with the cursor on the heading.
  await page.keyboard.press('Alt+g');
  const picker = page.getByRole('listbox', { name: 'Sections' });
  await expect(picker.getByRole('option')).toHaveText(['One', 'One point five', 'Two']);
  await expect(picker.getByRole('option', { selected: true })).toHaveText('One');
  await page.keyboard.press('j');
  await page.keyboard.press('j');
  await page.keyboard.press('Enter');
  await expect(picker).toHaveCount(0);
  await page.keyboard.type('X');
  await expect(source).toContainText('X## Two');
  await page.keyboard.press('ControlOrMeta+z');
  // ⌥G again closes it.
  await page.keyboard.press('Alt+g');
  await expect(picker).toBeVisible();
  await page.keyboard.press('Alt+g');
  await expect(picker).toHaveCount(0);

  // ⌥Z hides the threads until it's pressed again.
  const margin = page.getByRole('complementary', { name: 'Threads' }).first();
  await expect(margin).toContainText('punchier?');
  await page.keyboard.press('Alt+z');
  await expect(margin).toHaveCount(0);
  await expect(page.getByRole('button', { name: /hidden/ })).toBeVisible();
  await page.keyboard.press('Alt+z');
  await expect(margin).toContainText('punchier?');

  // ⌥⇧N sends /notes to the page thread.
  await page.keyboard.press('Alt+Shift+n');
  await expect(page.getByRole('complementary', { name: 'Page thread' })).toContainText('/notes');
  expect(await readFile(postPath('first'), 'utf8')).not.toMatch(/[©Ω˜ˆ∆˚]/);
});
