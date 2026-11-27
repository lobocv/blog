import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeLiveChecker } from '../app/testing/fakes.ts';
import { liveCheckerContract } from './contracts/live-checker.ts';
import { decodeEntities, HttpLiveChecker, metaTags } from './live-checker.ts';

const card = (image: string) =>
  `<html><head><meta property="og:title" content="Title"><meta property="og:description" content="Desc">` +
  `<meta property="og:image" content="${image}"><meta name="twitter:card" content="summary_large_image">` +
  `<meta name="twitter:site" content="@lobocv"></head></html>`;

// A small site: each path answers one way the real one might.
const pages: Record<string, (res: import('node:http').ServerResponse) => void> = {
  '/good/': (res) => res.end(card('/og/good.png')),
  '/og/good.png': (res) => res.writeHead(200, { 'content-type': 'image/png' }).end('png'),
  '/moved/': (res) => res.writeHead(301, { location: '/good/' }).end(),
  '/slow/': () => {},
  '/gone/': (res) => res.writeHead(404).end('not found'),
  '/html-image/': (res) => res.end(card('/gone/')),
  '/query-image/': (res) => res.end(card('/og/q.png?v=1&amp;w=2')),
  '/og/q.png': (res) => res.writeHead(200, { 'content-type': 'image/png' }).end('png'),
  '/bare/': (res) => res.end('<html><head><title>No card</title></head></html>'),
};

let server: Server;
let origin: string;
const requests: string[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    requests.push(req.url!);
    (pages[req.url!.split('?')[0]] ?? pages['/gone/'])(res);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});

liveCheckerContract('fake', async () => ({
  checker: new FakeLiveChecker({ 'https://site/good/': [{ ok: true, message: 'page loads (200)' }] }),
  good: 'https://site/good/',
  bad: 'https://site/bad/',
}));
liveCheckerContract('http', async () => ({ checker: new HttpLiveChecker(2000), good: `${origin}/good/`, bad: 'http://127.0.0.1:9/' }));

describe('HttpLiveChecker', () => {
  const check = (path: string, timeout = 2000) => new HttpLiveChecker(timeout).check(`${origin}${path}`);
  const failed = async (path: string, timeout?: number) => (await check(path, timeout)).filter((r) => !r.ok).map((r) => r.message);

  it('passes a good page, and resolves a relative og:image against it', async () => {
    expect(await failed('/good/')).toEqual([]);
    expect((await check('/good/')).at(-1)?.message).toBe('og:image loads (200, image/png)');
  });

  it('follows redirects and says where it ended up', async () => {
    expect((await check('/moved/'))[0]).toEqual({ ok: true, message: `page loads (200, via ${origin}/good/)` });
  });

  it('times out instead of hanging', async () => {
    expect(await failed('/slow/', 200)).toEqual(['page loads: timed out after 0.2s']);
  });

  it('fails a missing page and a page without a card', async () => {
    expect(await failed('/gone/')).toContain('page loads (404)');
    expect(await failed('/bare/')).toEqual(['og:title: missing', 'og:description: missing', 'og:image: missing', 'twitter:card: missing', 'twitter:site: missing', 'large preview card']);
  });

  it("fails an og:image that isn't an image", async () => {
    expect(await failed('/html-image/')).toEqual(['og:image loads (404, no type)']);
  });

  it('decodes entities in the og:image URL before fetching it', async () => {
    requests.length = 0;
    expect(await failed('/query-image/')).toEqual([]);
    expect(requests).toContain('/og/q.png?v=1&w=2');
  });
});

describe('metaTags', () => {
  it('reads attributes in any order and quoting, and keeps the first of each', () => {
    expect(
      metaTags(`<META content='One' property="og:title"><meta content=Two name=twitter:card /><meta property="og:title" content="Later">`),
    ).toEqual({ 'og:title': 'One', 'twitter:card': 'Two' });
  });

  it('ignores meta tags without a key or content', () => {
    expect(metaTags('<meta charset="utf-8"><meta name="x">')).toEqual({});
  });
});

it.each([
  ['a &amp; b', 'a & b'],
  ['&quot;q&quot; &#39;s&#x27;', `"q" 's'`],
  ['&unknown; stays', '&unknown; stays'],
])('decodes %j', (a, b) => expect(decodeEntities(a)).toBe(b));
