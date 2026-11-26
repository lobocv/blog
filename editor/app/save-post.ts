import { isSlug } from '../domain/post.ts';
import { NotFound } from './errors.ts';
import { reanchor } from '../domain/thread.ts';
import type { PostLibrary, ThreadStore } from './ports.ts';

/**
 * Saves Calvin's typing, and moves thread anchors along with the text so the stored line hints
 * stay close. Claude never calls this: its edits arrive as suggestions.
 */
export const savePost = (library: PostLibrary, threads: ThreadStore) => async (slug: string, text: string): Promise<void> => {
  // Only existing posts, so a save after a delete can't bring the post back.
  if (!isSlug(slug) || !(await library.read(slug))) throw new NotFound(`No post named "${slug}".`);
  await library.write(slug, text);
  const current = await threads.load(slug);
  if (current.length) await threads.save(slug, reanchor(current, text));
};
