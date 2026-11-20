import type { Post } from './posts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * RSS 2.0 feed of the given posts. Written by hand rather than with @astrojs/rss because the guids
 * must stay exactly what Hugo published (http://, trailing slash), or feed readers show every post as new.
 */
export function buildFeed(posts: Post[], site: string): string {
  const base = site.replace(/\/$/, '');
  const items = posts.map(p => {
    const path = `/posts/${p.id}/`;
    return `<item><title>${esc(p.data.title)}</title><link>${base}${path}</link>` +
      `<guid isPermaLink="false">http://blog.lobocv.com${path}</guid>` +
      (p.data.date ? `<pubDate>${p.data.date.toUTCString()}</pubDate>` : '') +
      `<description>${esc(p.data.summary ?? '')}</description></item>`;
  }).join('');
  return `<?xml version="1.0" encoding="utf-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>` +
    `<title>lobocv</title><link>${base}/</link><description>Calvin Lobo on software architecture, Go, databases and developer efficiency.</description>` +
    `<language>en</language><atom:link href="${base}/index.xml" rel="self" type="application/rss+xml"/>${items}</channel></rss>\n`;
}
