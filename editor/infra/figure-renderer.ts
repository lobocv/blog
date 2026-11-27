// Renders a figure to a PNG with headless Chromium (Playwright's, already installed for the
// end-to-end tests), from the preview server's one-figure page (src/lib/editor-figure.astro).
// The figure is laid out at the post's column width in the chosen theme, with its info buttons
// and side foliage hidden, then zoomed and padded in the page's background to the exact size.
import { type Browser, chromium, type Page } from '@playwright/test';
import type { ImageRenderer, RenderTarget } from '../app/ports.ts';
import type { Size } from '../domain/social/network.ts';
import type { Theme } from '../domain/social/social-post.ts';

/** The post's text column on the site, so a figure lays out as readers see it. */
const COLUMN = 680;
/** Space around the figure, in the column's pixels. */
const PAD = 40;

const CSS = `
  *, *::before, *::after { transition: none !important; caret-color: transparent !important; }
  html, body { background: var(--sheet, #0d131c) !important; }
  .fig-info, .fig-pop, .side-foliage { display: none !important; }
  #figure { width: ${COLUMN}px !important; max-width: none !important; margin: 0 !important; padding: 0 !important; box-sizing: border-box; }
  body.share-render { margin: 0 !important; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; overflow: hidden; }
`;

/** Waits for animations that end (eg a figure drawing itself in), up to `ms`. Endless ones are left running. */
async function settle(page: Page, ms: number) {
  await page.evaluate(async (limit) => {
    const ending = document.getAnimations().filter((a) => Number.isFinite(Number(a.effect?.getComputedTiming().endTime)));
    await Promise.race([Promise.all(ending.map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, limit))]);
  }, ms);
}

export class PlaywrightRenderer implements ImageRenderer {
  #browser: Promise<Browser> | undefined;
  readonly #animationMs: number;
  readonly #settleMs: number;

  /** `animationMs` caps the wait for animations; `settleMs` is extra time for script-driven ones. */
  constructor({ animationMs = 5000, settleMs = 500 } = {}) {
    this.#animationMs = animationMs;
    this.#settleMs = settleMs;
  }

  #launch() {
    this.#browser ??= chromium.launch().catch((err: Error) => {
      this.#browser = undefined;
      throw new Error(`Couldn't start Chromium to render images. Run \`npx playwright install chromium\`. (${err.message.split('\n')[0]})`);
    });
    return this.#browser;
  }

  async render(target: RenderTarget, { theme, size }: { theme: Theme; size: (figure: Size) => Size }) {
    const browser = await this.#launch();
    const context = await browser.newContext({ viewport: { width: COLUMN + 2 * PAD, height: 1000 } });
    try {
      const page = await context.newPage();
      // As soon as <html> exists, before the page's CSS and scripts, so it renders in this theme from the start.
      await page.addInitScript((t) => {
        const set = () => Boolean(document.documentElement && (document.documentElement.dataset.time = t));
        if (!set()) new MutationObserver((_, o) => set() && o.disconnect()).observe(document, { childList: true });
      }, theme);
      const res = await page.goto(target.page, { waitUntil: 'load', timeout: 30_000 });
      if (!res?.ok()) throw new Error(`The figure page answered ${res?.status() ?? 'nothing'} (${target.page}).`);
      await page.addStyleTag({ content: CSS });
      if (target.image) {
        await page.evaluate(async (src) => {
          const img = new Image();
          img.src = src;
          img.alt = '';
          img.style.cssText = 'display:block;width:100%';
          document.getElementById('figure')!.replaceChildren(img);
          await img.decode().catch(() => {
            throw new Error(`The image didn't load (${src}).`);
          });
        }, target.image);
      }
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await settle(page, this.#animationMs);
      await page.waitForTimeout(this.#settleMs);

      const box = await page.locator('#figure').boundingBox();
      const figure = { width: Math.round(box?.width ?? 0), height: Math.round(box?.height ?? 0) };
      if (!figure.width || !figure.height) throw new Error(`The figure rendered empty (${target.page}).`);

      // Zoom the padded figure to fill the output, so the PNG is exactly that size and stays sharp.
      const out = size(figure);
      const ratio = out.width / out.height;
      const across = Math.max(figure.width + 2 * PAD, (figure.height + 2 * PAD) * ratio);
      await page.setViewportSize(out);
      await page.evaluate((zoom) => {
        document.body.classList.add('share-render');
        document.getElementById('figure')!.style.zoom = String(zoom);
      }, out.width / across);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      return { png: new Uint8Array(await page.screenshot({ type: 'png' })), figure };
    } finally {
      await context.close();
    }
  }

  async close() {
    const browser = await this.#browser?.catch(() => undefined);
    await browser?.close();
  }
}
