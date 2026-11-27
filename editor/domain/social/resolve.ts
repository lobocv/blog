// What a network's post is once its defaults are filled in. The share page and the files on disk
// both come from this, so what's on screen is what gets written.
import { hashtagsFor } from './hashtags.ts';
import { taggedUrl } from './links.ts';
import type { Assembled, MediaKind, Network, Parts } from './network.ts';
import type { SocialPost } from './social-post.ts';

/** What every network's post shares: the published post it's about. */
export type ShareContext = { postUrl: string; categories: string[] };

export type Resolved = { parts: Parts; media: MediaKind; assembled: Assembled };

export function resolvePost(network: Network, post: SocialPost, ctx: ShareContext): Resolved {
  const parts: Parts = {
    text: post.text,
    // Only tagged links for now; short links come with milestone 4.
    link: taggedUrl(ctx.postUrl, network.utmSource),
    hashtags: post.hashtags ?? hashtagsFor(ctx.categories, network.hashtags.max),
  };
  const media = post.media && network.media.includes(post.media.kind) ? post.media.kind : network.defaultMedia;
  return { parts, media, assembled: network.assemble(parts) };
}
