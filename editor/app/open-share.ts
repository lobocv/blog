import { publishedPost, fill, type SharedPost } from './share-post.ts';
import type { LiveCheck, LiveChecker, PostLibrary, ShareStore } from './ports.ts';
import type { ShareState } from '../domain/social/social-post.ts';
import { type FigureOption, postFigures } from '../domain/social/figures.ts';
import { postUrl } from '../domain/social/links.ts';

export type OpenedShare = { post: SharedPost; state: ShareState; figures: FigureOption[] };

/** A published post's share state, with a post for every enabled network, and the figures an image can show. Opening writes nothing. */
export const openShare = (deps: { library: PostLibrary; share: ShareStore }) => async (slug: string): Promise<OpenedShare> => {
  const post = await publishedPost(deps.library, slug);
  const text = (await deps.library.read(slug))?.text ?? '';
  return { post, state: fill(await deps.share.load(slug)), figures: postFigures(text, deps.library.pathOf(slug)) };
};

/**
 * Pre-flight: the live page, its OG tags and preview image. Separate from opening, so the page
 * doesn't wait on the network. `origin` is where to check (the deployed site, or a test server).
 */
export const preflight = (deps: { library: PostLibrary; checker: LiveChecker; origin?: string }) => async (slug: string): Promise<LiveCheck[]> => {
  await publishedPost(deps.library, slug);
  return deps.checker.check(postUrl(slug, deps.origin));
};
