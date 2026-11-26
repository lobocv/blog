import { postList, type PostSummary } from '../domain/post.ts';
import type { PostLibrary } from './ports.ts';

export const listPosts = (library: PostLibrary) => async (): Promise<PostSummary[]> => postList(await library.list());
