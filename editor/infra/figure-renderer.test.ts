import { existsSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeRenderer } from '../app/testing/fakes.ts';
import { imageRendererContract, pngSize } from './contracts/image-renderer.ts';
import { PlaywrightRenderer } from './figure-renderer.ts';

// The real renderer needs Playwright's Chromium (`npx playwright install chromium`, which
// `make verify-editor` runs). Without it, as on the deploy's CI, only the fake's contract runs.
const hasChromium = existsSync(chromium.executablePath());

const image = readFileSync(join(import.meta.dirname, '../../public/posts/elasticsearch_slots/img.png'));
const page = (body: string) => `<!doctype html><html><head><style>
  :root { --sheet: #101010; } :root[data-time="day"] { --sheet: #fafafa; }
  .box { height: 300px; background: teal; }
  :root[data-time="day"] .box { height: 340px; }
  .grow { height: 10px; animation: grow .3s ease-out forwards; } @keyframes grow { to { height: 200px; } }
</style></head><body class="editor-figure"><div class="post-body" id="figure">${body}</div></body></html>`;
const pages: Record<string, string> = {
  '/_editor/figure?src=box': page('<div class="box"></div><button class="fig-info" style="display:block;height:100px">i</button>'),
  '/_editor/figure?src=grow': page('<div class="grow"></div>'),
  '/_editor/figure': page('<p>No figure</p>'),
};

let server: Server;
let origin: string;
beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/img.png') return res.writeHead(200, { 'content-type': 'image/png' }).end(image);
    const html = pages[req.url!];
    if (!html) return res.writeHead(404).end('not found');
    res.writeHead(200, { 'content-type': 'text/html' }).end(html);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
const renderer = new PlaywrightRenderer({ settleMs: 50 });
afterAll(async () => {
  await renderer.close();
  server.close();
});

imageRendererContract('fake', async () => ({ renderer: new FakeRenderer(), target: { page: 'http://site/_editor/figure?src=x' } }));

describe.skipIf(!hasChromium)('PlaywrightRenderer', () => {
  imageRendererContract('playwright', async () => ({ renderer, target: { page: `${origin}/_editor/figure?src=box` } }));

  const figureOf = async (path: string, theme: 'day' | 'night' = 'day', image?: string) =>
    (await renderer.render({ page: `${origin}${path}`, image: image && `${origin}${image}` }, { theme, size: () => ({ width: 600, height: 314 }) })).figure;

  it('lays the figure out at the column width in the chosen theme, without its info button', async () => {
    expect(await figureOf('/_editor/figure?src=box', 'day')).toEqual({ width: 680, height: 340 });
    expect(await figureOf('/_editor/figure?src=box', 'night')).toEqual({ width: 680, height: 300 });
  });

  it('waits for animations to finish', async () => {
    expect((await figureOf('/_editor/figure?src=grow')).height).toBe(200);
  });

  it('shows an image in place of a component, at the column width', async () => {
    const { width, height } = pngSize(new Uint8Array(image));
    expect(await figureOf('/_editor/figure', 'day', '/img.png')).toEqual({ width: 680, height: Math.round((680 * height) / width) });
  });

  it('says what went wrong when the page or image is missing', async () => {
    await expect(figureOf('/_editor/figure?src=missing')).rejects.toThrow('answered 404');
    await expect(figureOf('/_editor/figure', 'day', '/missing.png')).rejects.toThrow("didn't load");
  });
});
