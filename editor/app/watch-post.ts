import { isSlug } from '../domain/post.ts';
import { NotFound } from './errors.ts';
import type { PostLibrary } from './ports.ts';

/** Tells the open editor when something else changes the post, so it can reload or merge. */
export const watchPost =
  (library: PostLibrary) =>
  (slug: string, onOutsideEdit: (text: string) => void): (() => void) => {
    if (!isSlug(slug)) throw new NotFound(`No post named "${slug}".`);
    return library.watch(slug, onOutsideEdit);
  };
