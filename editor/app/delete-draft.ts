import { isDraft, isSlug } from '../domain/post.ts';
import { NotFound, Refused } from './errors.ts';
import type { PostLibrary } from './ports.ts';

/** Deletes a draft. Published posts can't be deleted from the editor. */
export const deleteDraft = (library: PostLibrary) => async (slug: string): Promise<void> => {
  const post = isSlug(slug) ? await library.read(slug) : undefined;
  if (!post) throw new NotFound(`No post named "${slug}".`);
  if (!isDraft(post.text)) throw new Refused(`"${slug}" is published. Only drafts can be deleted here.`);
  await library.remove(slug);
};
