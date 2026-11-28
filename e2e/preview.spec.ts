import type { ChildProcess } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
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
  // And one with a figure component and an image, to comment on.
  await mkdir(join(root, 'src/content/posts/figs'), { recursive: true });
  await writeFile(
    join(root, 'src/content/posts/figs/index.mdx'),
    "---\ntitle: Figures\ndraft: true\n---\nimport ContextStack from '../../../components/post/ContextStack.astro';\n\nIntro.\n\n<ContextStack />\n\n![A dot](./dot.png)\n",
  );
  await cp(join(repo, 'public/posts/elasticsearch_slots/img.png'), join(root, 'src/content/posts/figs/dot.png'));
  // And a published one, to share with a figure as its image.
  await mkdir(join(root, 'src/content/posts/pub'), { recursive: true });
  await writeFile(
    join(root, 'src/content/posts/pub/index.mdx'),
    "---\ntitle: Published\nsummary: A post to share.\ndraft: false\ndate: 2026-11-01\ncategories: [\"AI\"]\n---\nimport ContextStack from '../../../components/post/ContextStack.astro';\n\nIntro.\n\n<ContextStack />\n",
  );
  // Comments go to Claude: a fake one, replaying a recorded reply.
  process.env.FAKE_CLAUDE_STREAM = join(repo, 'editor/infra/testdata/reply.jsonl');
  editor = await startEditor(root, port, '--claude', join(repo, 'editor/infra/testdata/fake-claude.mjs'));
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

test('clicking a figure or an image in the preview picks it for ⌘K', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${port}/?post=figs`);
  await expect(page.getByLabel('Post source')).toContainText('<ContextStack />');
  await page.keyboard.press('ControlOrMeta+Backslash');
  const stored = async () => JSON.parse(await readFile(join(root, 'writing/threads/figs.json'), 'utf8').catch(() => '{"threads":[]}')).threads;

  // The thread quotes the line that places the figure.
  const figure = frame(page).locator('[data-figure="ContextStack"]');
  await expect(figure).toBeVisible({ timeout: 60_000 });
  await figure.click({ position: { x: 5, y: 5 } });
  await expect(figure).toHaveAttribute('data-editor-pick', '');
  await figure.press('ControlOrMeta+k');
  await page.getByLabel('Comment').fill('fewer layers?');
  await page.getByLabel('Comment').press('Enter');
  await expect.poll(async () => (await stored())[0]?.anchor).toEqual({ quote: '<ContextStack />', line: 9 });
  await expect(figure).toHaveAttribute('data-editor-mark', 'on');

  const image = frame(page).locator('#body img[data-figure="image"]');
  await image.click();
  await image.press('ControlOrMeta+k');
  await page.getByLabel('Comment').fill('bigger');
  await page.getByLabel('Comment').press('Enter');
  await expect.poll(async () => (await stored())[1]?.anchor).toEqual({ quote: '![A dot](./dot.png)', line: 11 });
  // The image's own highlight, not its paragraph's, and the site's zoomed view stayed shut.
  await expect(image).toHaveAttribute('data-editor-mark', 'on');
  await expect(frame(page).getByRole('dialog', { name: 'Image' })).toBeHidden();
});

test('Source shows figures under the lines that place them, without reloading them as Calvin types', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${port}/?post=figs`);
  const source = page.getByLabel('Post source');
  await expect(source).toContainText('<ContextStack />');
  // The imports are hidden.
  await expect(source).not.toContainText('import ContextStack');

  const figure = page.frameLocator('.cm-figure iframe').locator('figure.fig');
  await expect(figure).toBeVisible({ timeout: 60_000 });
  const frameHeight = await page.locator('.cm-figure iframe').evaluate((el) => el.getBoundingClientRect().height);
  expect(frameHeight).toBeGreaterThan(100);
  await expect(page.locator('.cm-figure img')).toBeVisible();

  // Typing saves the post; the figure page doesn't depend on it, so it stays loaded.
  const loaded = () => page.frameLocator('.cm-figure iframe').locator('body').evaluate(() => performance.timeOrigin);
  const before = await loaded();
  await source.getByText('Intro.').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' More.');
  await expect.poll(() => readFile(join(root, 'src/content/posts/figs/index.mdx'), 'utf8')).toContain('Intro. More.');
  await page.waitForTimeout(1500);
  expect(await loaded()).toBe(before);

  // Changing the figure's code reloads it.
  const file = join(root, 'src/components/post/ContextStack.astro');
  await writeFile(file, (await readFile(file, 'utf8')) + '\n');
  await expect.poll(loaded, { timeout: 10_000 }).not.toBe(before);
});

/** A PNG's size, from its header chunk. */
const pngSize = (png: Buffer) => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) });

test('renders a figure as the share image, in the shape and theme chosen', async ({ page }) => {
  const png = join(root, 'writing/share/pub/linkedin.png');
  await page.goto(`http://127.0.0.1:${port}/?share=pub`);
  // The preview card is the image until another is picked.
  await expect(page.getByRole('button', { name: 'Preview card' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('1200 × 628')).toBeVisible({ timeout: 60_000 });
  expect(pngSize(await readFile(png))).toEqual({ width: 1200, height: 628 });

  await page.getByRole('button', { name: 'ContextStack' }).click();
  // A component needs its own alt text.
  await expect(page.getByLabel('Failing checks')).toContainText('The image has no alt text');
  await page.getByLabel('Alt text').fill('A stack of context layers.');
  await expect(page.getByText('The image has no alt text')).toHaveCount(0);

  await page.getByRole('group', { name: 'Shape' }).getByRole('button', { name: 'Portrait' }).click();
  await expect(page.getByText('1080 × 1350')).toBeVisible({ timeout: 30_000 });
  expect(pngSize(await readFile(png))).toEqual({ width: 1080, height: 1350 });
  const day = (await stat(png)).size;

  await page.getByRole('group', { name: 'Theme' }).getByRole('button', { name: 'Night' }).click();
  await expect.poll(async () => (await stat(png)).size, { timeout: 30_000 }).not.toBe(day);
  await expect
    .poll(async () => JSON.parse(await readFile(join(root, 'writing/share/pub/share.json'), 'utf8')).networks.linkedin.media)
    .toEqual({ kind: 'image', figure: { kind: 'component', source: 'src/components/post/ContextStack.astro' }, alt: 'A stack of context layers.', shape: 'portrait', theme: 'night' });
  await expect(page.getByLabel('LinkedIn preview').locator('img.fp-image')).toBeVisible();
});
