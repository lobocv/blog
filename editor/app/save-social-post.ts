// Calvin's edits to a network's post, and its versions.
import { cleanHashtag } from '../domain/social/hashtags.ts';
import { resolvePost } from '../domain/social/resolve.ts';
import { type Change, edit, markCopied, restore, type Version } from '../domain/social/social-post.ts';
import type { Clock } from './ports.ts';
import { changePost, type Deps } from './share-post.ts';

/** Hashtags as typed, cleaned, without blanks or repeats. */
export const clean = (tags: string[]) => [...new Map(tags.map(cleanHashtag).filter(Boolean).map((t) => [t.toLowerCase(), t])).values()];

const tidy = (change: Change): Change => (change.hashtags ? { ...change, hashtags: clean(change.hashtags) } : change);

/** Saves what Calvin typed or chose (autosave). Doesn't make a version. */
export const saveSocialPost = (deps: Deps) => (slug: string, networkId: string, change: Change) =>
  changePost(deps, slug, networkId, (post) => edit(post, tidy(change)));

export type Snapshot = { text: string; hashtags?: string[] };

const version = (clock: Clock, post: { hashtags?: string[] }, s: Snapshot, fallback: string[]): Version => ({
  text: s.text,
  hashtags: s.hashtags ? clean(s.hashtags) : (post.hashtags ?? fallback),
  author: 'calvin',
  at: clock.now().toISOString(),
});

/** Calvin copied the text: what he copied (sent with the request, not what was saved last) becomes a version. */
export const copiedSocialPost = (deps: Deps & { clock: Clock }) => (slug: string, networkId: string, copied: Snapshot) =>
  changePost(deps, slug, networkId, (post, network, ctx) =>
    markCopied(post, version(deps.clock, post, copied, resolvePost(network, post, ctx).parts.hashtags)),
  );

/** Brings back version `index`, keeping `current` (the text on screen) as a version first. */
export const restoreSocialPost = (deps: Deps & { clock: Clock }) => (slug: string, networkId: string, index: number, current: Snapshot) =>
  changePost(deps, slug, networkId, (post, network, ctx) =>
    restore(post, index, version(deps.clock, post, current, resolvePost(network, post, ctx).parts.hashtags)),
  );
