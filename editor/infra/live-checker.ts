// Pre-flight against the deployed site: the page loads, its preview card tags are there, and the
// preview image loads.
import type { LiveCheck, LiveChecker } from '../app/ports.ts';

const TAGS = ['og:title', 'og:description', 'og:image', 'twitter:card', 'twitter:site'];

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };

/** Decodes the HTML entities Astro writes into attributes (eg &amp; in a query string). */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e.toLowerCase()] ?? whole;
  });
}

/** The page's meta tags by property (or name). The first of each wins, as crawlers read them. */
export function metaTags(html: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs: Record<string, string> = {};
    for (const m of tag.slice(5).matchAll(/([^\s=/>"']+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
      attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4]);
    }
    const key = attrs.property ?? attrs.name;
    if (key && 'content' in attrs && !(key in tags)) tags[key] = attrs.content;
  }
  return tags;
}

export class HttpLiveChecker implements LiveChecker {
  readonly #timeoutMs: number;

  constructor(timeoutMs = 10_000) {
    this.#timeoutMs = timeoutMs;
  }

  #fetch(url: string) {
    return fetch(url, { headers: { 'user-agent': 'lobocv-share-check' }, redirect: 'follow', signal: AbortSignal.timeout(this.#timeoutMs) });
  }

  #why(err: unknown) {
    const e = err as Error & { cause?: { code?: string } };
    if (e.name === 'TimeoutError') return `timed out after ${this.#timeoutMs / 1000}s`;
    return e.cause?.code ?? e.message;
  }

  async check(url: string): Promise<LiveCheck[]> {
    let res: Response;
    let html: string;
    try {
      res = await this.#fetch(url);
      html = await res.text();
    } catch (err) {
      return [{ ok: false, message: `page loads: ${this.#why(err)}` }];
    }
    const out: LiveCheck[] = [];
    const moved = res.redirected && res.url !== url ? `, via ${res.url}` : '';
    out.push({ ok: res.ok, message: `page loads (${res.status}${moved})` });

    const tags = metaTags(html);
    for (const key of TAGS) out.push({ ok: Boolean(tags[key]), message: `${key}: ${tags[key] || 'missing'}` });
    out.push({ ok: tags['twitter:card'] === 'summary_large_image', message: 'large preview card' });

    if (tags['og:image']) {
      try {
        const image = new URL(tags['og:image'], res.url || url).toString();
        const img = await this.#fetch(image);
        await img.arrayBuffer();
        const type = img.headers.get('content-type') ?? '';
        out.push({ ok: img.ok && type.startsWith('image/'), message: `og:image loads (${img.status}, ${type || 'no type'})` });
      } catch (err) {
        out.push({ ok: false, message: `og:image loads: ${this.#why(err)}` });
      }
    }
    return out;
  }
}
