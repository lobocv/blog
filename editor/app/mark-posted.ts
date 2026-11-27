import { resolvePost } from '../domain/social/resolve.ts';
import { clearPosted, markPosted as posted } from '../domain/social/social-post.ts';
import { Refused } from './errors.ts';
import type { Clock } from './ports.ts';
import { changePost, type Deps } from './share-post.ts';

/** Records the URL of the post Calvin made, the time, and the text as it went out. */
export const markPosted = (deps: Deps & { clock: Clock }) => async (slug: string, networkId: string, url: string) => {
  if (!/^https?:\/\/\S+$/.test(url)) throw new Refused(`"${url}" isn't a link.`);
  return changePost(deps, slug, networkId, (post, network, ctx) =>
    posted(post, { url, at: deps.clock.now().toISOString(), text: resolvePost(network, post, ctx).assembled.text }),
  );
};

/** Takes the posted record back off (eg a wrong URL, or the post was deleted). */
export const unmarkPosted = (deps: Deps) => (slug: string, networkId: string) => changePost(deps, slug, networkId, (post) => clearPosted(post));
