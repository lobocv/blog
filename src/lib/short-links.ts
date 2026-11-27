// The pages the build writes for short links (src/pages/s/[code].astro).
import { isCode, type ShortLink } from '../../shared/short-links.ts';

export type ShortLinkPage = { code: string; to: string; post: { id: string; title: string; summary?: string } };

/**
 * One page per code. Fails the build, with what to fix, on a code that isn't valid or points at a
 * post that's gone or unpublished, since a short link that was posted must never quietly break.
 */
export function shortLinkPages(links: Record<string, ShortLink>, posts: ShortLinkPage['post'][]): ShortLinkPage[] {
  return Object.entries(links).map(([code, link]) => {
    const fix = 'Fix src/data/short-links.json.';
    if (!isCode(code)) throw new Error(`"${code}" isn't a short link code. ${fix}`);
    if (!link.to?.startsWith('/') || link.to.startsWith('//')) throw new Error(`Short link ${code} goes to "${link.to}", which isn't a path on the site. ${fix}`);
    const post = posts.find((p) => p.id === link.post);
    if (!post) throw new Error(`Short link ${code} is for "${link.post}", which isn't a published post. ${fix}`);
    return { code, to: link.to, post };
  });
}
