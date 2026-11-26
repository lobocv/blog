import { isSlug } from '../domain/post.ts';
import { type Review, setReview } from '../domain/review.ts';
import type { Thread } from '../domain/thread.ts';
import { NotFound, Refused } from './errors.ts';
import type { PostLibrary, ThreadStore } from './ports.ts';

/** From Claude, as it works through a critique. Refused (with a reason Claude can act on) when the numbers don't add up. */
export const reportReview =
  ({ library, threads }: { library: PostLibrary; threads: ThreadStore }) =>
  async (slug: string, review: Review): Promise<Thread[]> => {
    if (!isSlug(slug) || !(await library.read(slug))) throw new NotFound(`No post named "${slug}".`);
    const result = setReview(await threads.load(slug), review);
    if ('error' in result) throw new Refused(result.error);
    await threads.save(slug, result.threads);
    return result.threads;
  };
