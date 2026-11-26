import { drafts, type DraftSummary } from '../domain/post.ts';
import type { PostLibrary } from './ports.ts';

export const listDrafts = (library: PostLibrary) => async (): Promise<DraftSummary[]> => drafts(await library.list());
