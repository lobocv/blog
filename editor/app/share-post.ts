// What the share use cases have in common: the published post being shared, and applying a
// change to one network's post so share.json and the ready-to-paste files move together.
import { readFrontMatter } from '../domain/front-matter.ts';
import { isDraft, isSlug, title } from '../domain/post.ts';
import { networkById, networks } from '../domain/social/networks/registry.ts';
import type { Network } from '../domain/social/network.ts';
import { resolvePost, type ShareContext } from '../domain/social/resolve.ts';
import { emptyPost, SCHEMA_VERSION, type ShareState, type SocialPost, withNetworks } from '../domain/social/social-post.ts';
import { postUrl, previewImageUrl } from '../domain/social/links.ts';
import { NotFound, Refused } from './errors.ts';
import type { PostLibrary, ShareStore, ShareUpdate } from './ports.ts';

export type SharedPost = ShareContext & { slug: string; title: string; summary: string; image: string };

/** The published post, or NotFound / Refused (drafts can't be shared). */
export async function publishedPost(library: PostLibrary, slug: string): Promise<SharedPost> {
  const file = isSlug(slug) ? await library.read(slug) : undefined;
  if (!file) throw new NotFound(`No post named "${slug}".`);
  if (isDraft(file.text)) throw new Refused(`"${slug}" is a draft. Publish it before sharing.`);
  const fm = readFrontMatter(file.text);
  return {
    slug,
    title: title(file.text) ?? slug,
    summary: fm?.summary ?? '',
    categories: fm?.categories ?? [],
    postUrl: postUrl(slug),
    image: previewImageUrl(slug),
  };
}

/** The state with a post for every enabled network. */
export const fill = (state: ShareState | undefined): ShareState =>
  withNetworks(state ?? { schemaVersion: SCHEMA_VERSION, networks: {} }, networks.map((n) => n.id));

/** The ready-to-paste text for each enabled network. */
export function texts(state: ShareState, ctx: ShareContext): Record<string, string> {
  return Object.fromEntries(networks.map((n) => [n.id, resolvePost(n, state.networks[n.id] ?? emptyPost(), ctx).assembled.text]));
}

export type Deps = { library: PostLibrary; share: ShareStore };

/** Changes one network's post, writing share.json and every network's text together. */
export async function changePost(
  deps: Deps,
  slug: string,
  networkId: string,
  change: (post: SocialPost, network: Network, ctx: SharedPost) => SocialPost,
): Promise<ShareState> {
  const post = await publishedPost(deps.library, slug);
  const network = networkById(networkId);
  if (!network) throw new NotFound(`No network named "${networkId}".`);
  return deps.share.update(slug, (current): ShareUpdate => {
    const state = fill(current);
    state.networks[network.id] = change(state.networks[network.id], network, post);
    return { state, texts: texts(state, post) };
  });
}
