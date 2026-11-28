import { publishedPost, fill, type SharedPost } from './share-post.ts';
import type { LiveCheck, LiveChecker, PostLibrary, ShareStore, ShortLinks } from './ports.ts';
import type { ShareState } from '../domain/social/social-post.ts';
import { type FigureOption, postFigures } from '../domain/social/figures.ts';
import { postUrl, shortPath, shortUrl } from '../domain/social/links.ts';

export type OpenedShare = { post: SharedPost; state: ShareState; figures: FigureOption[] };

/** A published post's share state, with a post for every enabled network, and the figures an image can show. Opening writes nothing. */
export const openShare = (deps: { library: PostLibrary; share: ShareStore }) => async (slug: string): Promise<OpenedShare> => {
  const post = await publishedPost(deps.library, slug);
  const text = (await deps.library.read(slug))?.text ?? '';
  return { post, state: fill(await deps.share.load(slug)), figures: postFigures(text, deps.library.pathOf(slug)) };
};

/**
 * Pre-flight: the live page, its OG tags and preview image, and each short link's page. Separate
 * from opening, so the page doesn't wait on the network. `origin` is where to check (the deployed
 * site, or a test server).
 */
export const preflight =
  (deps: { library: PostLibrary; checker: LiveChecker; share: ShareStore; links: ShortLinks; origin?: string }) =>
  async (slug: string): Promise<LiveCheck[]> => {
    await publishedPost(deps.library, slug);
    const state = fill(await deps.share.load(slug));
    const codes = [...new Set(Object.values(state.networks).flatMap((p) => (p.link?.kind === 'short' && p.link.code ? [p.link.code] : [])))];
    const links = codes.length ? await deps.links.all() : {};
    const [page, ...short] = await Promise.all([
      deps.checker.check(postUrl(slug, deps.origin)),
      ...codes.map((code) =>
        links[code]
          ? deps.checker.redirects(shortUrl(code, deps.origin), links[code].to).then((r) => ({ ...r, code }))
          : Promise.resolve({ ok: false, message: `${shortPath(code)} isn't in src/data/short-links.json`, code }),
      ),
    ]);
    return [...page, ...short];
  };
