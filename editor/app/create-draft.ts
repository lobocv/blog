import { dayOf, isSlug, newDraft, slugFor } from '../domain/post.ts';
import { Refused } from './errors.ts';
import type { Clock, PostLibrary } from './ports.ts';

/** Starts a draft from a title: a folder named after it with front matter only. Returns its slug. */
export const createDraft = (library: PostLibrary, clock: Clock) => async (title: string): Promise<string> => {
  const slug = slugFor(title);
  if (!title.trim() || !isSlug(slug)) throw new Refused('The title needs a letter or number in it.');
  if (await library.read(slug)) throw new Refused(`There is already a post named "${slug}".`);
  await library.write(slug, newDraft(title.trim(), dayOf(clock.now())));
  return slug;
};
