import { isSlug } from '../domain/post.ts';
import { NotFound } from './errors.ts';
import type { PostLibrary } from './ports.ts';

export type OpenedPost = { slug: string; name: string; text: string };

export const openPost = (library: PostLibrary) => async (slug: string): Promise<OpenedPost> => {
  const post = isSlug(slug) ? await library.read(slug) : undefined;
  if (!post) throw new NotFound(`No post named "${slug}".`);
  return { slug, name: library.pathOf(slug), text: post.text };
};
