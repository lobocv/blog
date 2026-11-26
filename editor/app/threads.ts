// Use cases for comment threads. One file because they share the same load, change, save shape.
import type { Anchor } from '../domain/anchor.ts';
import { isSlug } from '../domain/post.ts';
import { comment, PAGE, reanchor, reply, resolve, type Thread } from '../domain/thread.ts';
import { NotFound } from './errors.ts';
import type { Clock, PostLibrary, ThreadStore } from './ports.ts';

type Deps = { library: PostLibrary; threads: ThreadStore; clock: Clock };

async function postText({ library }: Deps, slug: string): Promise<string> {
  const post = isSlug(slug) ? await library.read(slug) : undefined;
  if (!post) throw new NotFound(`No post named "${slug}".`);
  return post.text;
}

/** The post's threads, with anchors checked against the text as it is now. */
export const listThreads = (deps: Deps) => async (slug: string): Promise<Thread[]> =>
  reanchor(await deps.threads.load(slug), await postText(deps, slug));

/** Calvin comments on quoted text, or on the whole post when there is no anchor. Returns the thread's id too. */
export const addComment =
  (deps: Deps) =>
  async (slug: string, c: { anchor?: Anchor; text: string }): Promise<{ threads: Thread[]; id: string }> => {
    await postText(deps, slug);
    const id = c.anchor ? deps.clock.id() : PAGE;
    const next = comment(await deps.threads.load(slug), { ...c, id, at: deps.clock.now().toISOString() });
    await deps.threads.save(slug, next);
    return { threads: next, id };
  };

export const replyToThread = (deps: Deps) => async (slug: string, id: string, text: string): Promise<Thread[]> => {
  await postText(deps, slug);
  const next = reply(await deps.threads.load(slug), id, { author: 'calvin', text, at: deps.clock.now().toISOString() });
  if (!next) throw new NotFound(`No thread "${id}" on "${slug}".`);
  await deps.threads.save(slug, next);
  return next;
};

export const resolveThread = (deps: Deps) => async (slug: string, id: string): Promise<Thread[]> => {
  await postText(deps, slug);
  const next = resolve(await deps.threads.load(slug), id);
  if (!next) throw new NotFound(`No thread "${id}" on "${slug}".`);
  await deps.threads.save(slug, next);
  return next;
};
