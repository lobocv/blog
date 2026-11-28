// What a network's post is once its defaults are filled in. The share page and the files on disk
// both come from this, so what's on screen is what gets written.
import { figureKey } from './figures.ts';
import { hashtagsFor } from './hashtags.ts';
import { shortUrl, taggedUrl } from './links.ts';
import type { Assembled, MediaKind, Network, Parts } from './network.ts';
import type { FigureRef, SocialPost, Theme } from './social-post.ts';

/** What every network's post shares: the published post it's about. */
export type ShareContext = { postUrl: string; categories: string[]; title: string; summary: string };

/** The image with its defaults filled in. `shape` is unset until Calvin picks one: the renderer then picks from the figure's size. */
export type ResolvedImage = { figure: FigureRef; theme: Theme; shape?: string; alt: string };

/** The link in the post: tagged, or short once the network has a code. `tagged` is always the tagged URL (a short link's destination). */
export type ResolvedLink = { kind: 'tagged' | 'short'; url: string; tagged: string; code?: string };

export type Resolved = { parts: Parts; media: MediaKind; assembled: Assembled; link: ResolvedLink; image?: ResolvedImage };

/** The choices an image is rendered from, so a render can be matched to them. Alt text isn't one. */
export const imageKey = (image: ResolvedImage): string => JSON.stringify([figureKey(image.figure), image.theme, image.shape ?? 'auto']);

export function resolvePost(network: Network, post: SocialPost, ctx: ShareContext): Resolved {
  const tagged = taggedUrl(ctx.postUrl, network.utmSource);
  const code = post.link?.code;
  // Short only once there's a code; until then (eg a network whose default is short) the tagged link.
  const link: ResolvedLink =
    (post.link?.kind ?? network.defaultLink) === 'short' && code ? { kind: 'short', url: shortUrl(code), tagged, code } : { kind: 'tagged', url: tagged, tagged, ...(code && { code }) };
  const parts: Parts = {
    text: post.text,
    link: link.url,
    hashtags: post.hashtags ?? hashtagsFor(ctx.categories, network.hashtags.max),
  };
  const media = post.media && network.media.includes(post.media.kind) ? post.media.kind : network.defaultMedia;
  const resolved: Resolved = { parts, media, assembled: network.assemble(parts), link };
  if (media === 'image') {
    const choice = post.media?.kind === 'image' ? post.media : undefined;
    const figure = choice?.figure ?? { kind: 'preview' };
    const shape = choice?.shape && network.imageShapes.some((s) => s.id === choice.shape) ? choice.shape : undefined;
    // The preview card shows the title and summary, so those describe it.
    const alt = choice?.alt ?? (figure.kind === 'preview' ? [ctx.title, ctx.summary].filter(Boolean).join('. ') : '');
    resolved.image = { figure, theme: choice?.theme ?? 'day', ...(shape && { shape }), alt };
  }
  return resolved;
}
