// Tagged or short link for a network's post. A short link gets a code the first time, added to
// src/data/short-links.json so the next build makes its page; switching back and forth reuses it.
import { codeFrom, sitePath } from '../domain/social/links.ts';
import { networkById } from '../domain/social/networks/registry.ts';
import { resolvePost } from '../domain/social/resolve.ts';
import { edit } from '../domain/social/social-post.ts';
import { NotFound } from './errors.ts';
import type { ShortLinks } from './ports.ts';
import { changePost, type Deps, fill, publishedPost } from './share-post.ts';

type LinkDeps = Deps & { links: ShortLinks; /** Random bytes for new codes. */ randomBytes: (n: number) => Uint8Array };

export const chooseLink = (deps: LinkDeps) => async (slug: string, networkId: string, kind: 'tagged' | 'short') => {
  const post = await publishedPost(deps.library, slug);
  const network = networkById(networkId);
  if (!network) throw new NotFound(`No network named "${networkId}".`);
  const current = fill(await deps.share.load(slug)).networks[network.id];
  let code = current.link?.code;
  if (kind === 'short') {
    const all = await deps.links.all();
    // A code made for another post (eg the data file was edited by hand) isn't this post's to reuse.
    if (!code || all[code]?.post !== slug) {
      const to = sitePath(resolvePost(network, current, post).link.tagged);
      for (let tries = 0; ; tries++) {
        code = codeFrom(deps.randomBytes(6));
        if (!all[code]) break;
        if (tries > 20) throw new Error("Couldn't find an unused short link code.");
      }
      await deps.links.add(code, { post: slug, to });
    }
  }
  return changePost(deps, slug, network.id, (p) => edit(p, { link: { kind, ...(code && { code }) } }));
};
