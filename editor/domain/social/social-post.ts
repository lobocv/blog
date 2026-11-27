// A post's share state: one SocialPost per network. Only Calvin's explicit choices are stored, so a
// network's defaults (and later ones, eg images in milestone 2) apply to posts that never chose.

export const SCHEMA_VERSION = 1;

/** What an image shows: the post's preview card, one of its figure components, or one of its images. */
export type FigureRef = { kind: 'preview' } | { kind: 'component'; source: string; props?: Record<string, string> } | { kind: 'image'; src: string };
export type Theme = 'day' | 'night';
/** Calvin's image choices. Unset fields keep their defaults (the preview card, day, the network's shape for the figure). */
export type ImageChoice = { kind: 'image'; figure?: FigureRef; shape?: string; theme?: Theme; alt?: string };
export type Media = { kind: 'link-card' } | { kind: 'text-only' } | ImageChoice;
/** What <network>.png holds: `key` is the choice it was rendered from (see imageKey), and the shape that was used. */
export type Rendered = { key: string; shape: string; width: number; height: number; at: string };
export type LinkChoice = { kind: 'tagged' };
export type Status = 'draft' | 'ready' | 'posted';

/** A saved copy of the text. Claude's drafts become versions too, in milestone 3. */
export type Version = { text: string; hashtags: string[]; author: 'calvin' | 'claude'; at: string };

export type SocialPost = {
  text: string;
  /** Undefined until Calvin changes them; then the post's categories no longer decide. */
  hashtags?: string[];
  media?: Media;
  link?: LinkChoice;
  status: Status;
  /** Oldest first. */
  versions: Version[];
  /** What went out, as posted, so later edits don't change the record. */
  posted?: { url: string; at: string; text: string };
  rendered?: Rendered;
};

export type ShareState = { schemaVersion: number; networks: Record<string, SocialPost> };

export const emptyPost = (): SocialPost => ({ text: '', status: 'draft', versions: [] });

/** Adds a post for each network that doesn't have one. Networks no longer enabled keep theirs. */
export function withNetworks(state: ShareState, ids: string[]): ShareState {
  const networks = { ...state.networks };
  for (const id of ids) networks[id] ??= emptyPost();
  return { ...state, networks };
}

export type Change = { text?: string; hashtags?: string[]; media?: Media };

/** Calvin's edit. A ready post goes back to draft; a posted one stays posted, since that's a record. */
export function edit(post: SocialPost, change: Change): SocialPost {
  const next: SocialPost = { ...post, ...change };
  const changed =
    (change.text !== undefined && change.text !== post.text) ||
    (change.hashtags !== undefined && change.hashtags.join(' ') !== post.hashtags?.join(' ')) ||
    (change.media !== undefined && JSON.stringify(change.media) !== JSON.stringify(post.media));
  if (changed && post.status === 'ready') next.status = 'draft';
  return next;
}

/** Keeps a copy of the text, unless it's the same as the latest version. */
export function keepVersion(post: SocialPost, version: Version): SocialPost {
  const last = post.versions.at(-1);
  if (last && last.text === version.text && last.hashtags.join(' ') === version.hashtags.join(' ')) return post;
  return { ...post, versions: [...post.versions, version] };
}

/** Copied to paste: the text as copied becomes a version, and the post is ready. */
export function markCopied(post: SocialPost, version: Version): SocialPost {
  const kept = keepVersion(edit(post, { text: version.text, hashtags: version.hashtags }), version);
  return post.status === 'posted' ? kept : { ...kept, status: 'ready' };
}

/**
 * Brings back a version. `current` (the text on screen, which may be newer than what's saved) is
 * kept as a version first, so restoring never loses anything.
 */
export function restore(post: SocialPost, index: number, current: Version): SocialPost {
  const version = post.versions[index];
  if (!version) return post;
  const kept = keepVersion(post, current);
  return edit(kept, { text: version.text, hashtags: version.hashtags });
}

export function markPosted(post: SocialPost, posted: { url: string; at: string; text: string }): SocialPost {
  return { ...post, status: 'posted', posted };
}

export function clearPosted(post: SocialPost): SocialPost {
  const { posted: _, ...rest } = post;
  return { ...rest, status: 'ready' };
}
