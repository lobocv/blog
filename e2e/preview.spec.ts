import type { ChildProcess } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { startEditor } from './start-editor.ts';

const port = 4440;
const repo = resolve(import.meta.dirname, '..');
let editor: ChildProcess;
let root: string;

// Astro takes a few seconds to start and render.
test.setTimeout(90_000);

test.beforeAll(async () => {
  // A copy of the site with one long draft, so Astro serves it without touching the real posts.
  root = await mkdtemp(join(tmpdir(), 'editor-preview-'));
  for (const f of ['astro.config.mjs', 'package.json', 'tsconfig.json', 'src', 'shared', 'public']) {
    await cp(join(repo, f), join(root, f), { recursive: true });
  }
  await symlink(join(repo, 'node_modules'), join(root, 'node_modules'));
  await rm(join(root, 'src/content/posts'), { recursive: true });
  await mkdir(join(root, 'src/content/posts/long'), { recursive: true });
  const body = Array.from({ length: 80 }, (_, i) => `Paragraph ${i + 1}.`).join('\n\n');
  await writeFile(join(root, 'src/content/posts/long/index.md'), `---\ntitle: Long draft\ndraft: true\n---\n\n${body}\n`);
  editor = await startEditor(root, port);
});

test.afterAll(async () => {
  editor?.kill();
  await rm(root, { recursive: true, force: true });
});

const frame = (page: Page) => page.frameLocator('iframe[title="Post preview"]');
const inView = async (page: Page, text: string) =>
  page.getByText(text, { exact: true }).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight;
  });

test('⌘\\ swaps to the real page and back, keeping the same paragraph in view', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${port}/?post=long`);
  await expect(page.getByLabel('Post source')).toContainText('Paragraph 1.');

  // Scroll the source most of the way down and note the paragraph at the top.
  const top = await page.locator('.page').first().evaluate(async (el) => {
    el.scrollTop = el.scrollHeight * 0.6;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const edge = el.getBoundingClientRect().top;
    return [...el.querySelectorAll('.cm-line')].find((l) => l.getBoundingClientRect().top >= edge && l.textContent)!.textContent!;
  });
  expect(top).toMatch(/^Paragraph [3-7]\d\.$/);

  await page.keyboard.press('ControlOrMeta+Backslash');
  const shown = frame(page).getByText(top, { exact: true });
  await expect(shown).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => shown.evaluate((el) => el.getBoundingClientRect().top), { timeout: 10_000 }).toBeLessThan(200);
  await expect(frame(page).getByText('Paragraph 1.', { exact: true })).not.toBeInViewport();

  // Scroll the page back to the top, then return to the source with the key pressed inside the page.
  await shown.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(200);
  await frame(page).locator('body').press('ControlOrMeta+Backslash');
  await expect(page.getByLabel('Post source')).toBeVisible();
  await expect.poll(() => inView(page, 'Paragraph 1.')).toBe(true);
});

test('comments on text selected in the preview, and the thread floats beside it', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${port}/?post=long`);
  await expect(page.getByLabel('Post source')).toContainText('Paragraph 1.');
  await page.keyboard.press('ControlOrMeta+Backslash');

  const p3 = frame(page).getByText('Paragraph 3.', { exact: true });
  await expect(p3).toBeVisible({ timeout: 60_000 });
  await p3.click();
  await p3.selectText();
  await p3.press('ControlOrMeta+k');
  await page.getByLabel('Comment').fill('merge with 2?');
  await page.getByLabel('Comment').press('Enter');

  // Stored against the source text, on the paragraph's line (front matter is 4 lines, then a blank).
  const stored = async () => JSON.parse(await readFile(join(root, 'writing/threads/long.json'), 'utf8').catch(() => '{"threads":[]}')).threads;
  await expect.poll(async () => (await stored())[0]?.anchor).toEqual({ quote: 'Paragraph 3.', line: 10 });

  // The thread floats level with its paragraph, and the paragraph is highlighted.
  const card = page.getByRole('complementary', { name: 'Threads' }).getByText('merge with 2?');
  await expect(card).toBeVisible();
  const [cardTop, paraTop] = [await card.evaluate((el) => el.getBoundingClientRect().top), await p3.evaluate((el) => el.getBoundingClientRect().top)];
  expect(Math.abs(cardTop - paraTop)).toBeLessThan(40);
  await expect(p3).toHaveAttribute('data-editor-mark', /.*/);

  // R pressed in the page replies to the selected thread.
  await frame(page).locator('body').press('r');
  await page.getByLabel('Reply').fill('yes');
  await page.getByLabel('Reply').press('Enter');
  await expect.poll(async () => (await stored())[0].messages.length).toBe(2);
});
