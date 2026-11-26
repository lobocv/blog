// Claude suggests edits through its suggest_edit tool; Calvin settles them in the editor.
import { isSlug } from '../domain/post.ts';
import { settle, suggest } from '../domain/suggestion.ts';
import type { Thread } from '../domain/thread.ts';
import { NotFound, Refused } from './errors.ts';
import type { Clock, PostLibrary, ThreadStore } from './ports.ts';

type Deps = { library: PostLibrary; threads: ThreadStore; clock: Clock };

async function postText(library: PostLibrary, slug: string) {
  const post = isSlug(slug) ? await library.read(slug) : undefined;
  if (!post) throw new NotFound(`No post named "${slug}".`);
  return post.text;
}

/** From Claude. Refused (with a message Claude can act on) when the suggestion doesn't fit the post. */
export const suggestEdit =
  ({ library, threads, clock }: Deps) =>
  async (
    slug: string,
    s: { threadId: string; find: string; replace: string; reason: string; mechanical?: boolean },
  ): Promise<Thread[]> => {
    const text = await postText(library, slug);
    const result = suggest(await threads.load(slug), text, { ...s, id: clock.id(), at: clock.now().toISOString() });
    if ('error' in result) throw new Refused(result.error);
    await threads.save(slug, result.threads);
    return result.threads;
  };

/** From Calvin, after the editor has applied an accepted edit to the text. */
export const settleSuggestion =
  ({ library, threads }: Deps) =>
  async (slug: string, id: string, status: 'accepted' | 'rejected', replace?: string): Promise<Thread[]> => {
    await postText(library, slug);
    const next = settle(await threads.load(slug), id, status, replace);
    if (!next) throw new NotFound(`No suggestion "${id}" on "${slug}".`);
    await threads.save(slug, next);
    return next;
  };
