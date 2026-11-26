// What the use cases need from the outside world. Adapters in infra/ implement
// these, and testing/fakes.ts has an in-memory version of each.
import type { PostFile } from '../domain/post.ts';
import type { Thread } from '../domain/thread.ts';

/**
 * The posts in src/content/posts, by slug. The files on disk are the only copy.
 * Callers check slugs with `isSlug` first.
 */
export interface PostLibrary {
  list(): Promise<PostFile[]>;
  /** Undefined when there is no such post. */
  read(slug: string): Promise<PostFile | undefined>;
  /** The post's path relative to the repo, for display. */
  pathOf(slug: string): string;
  write(slug: string, text: string): Promise<void>;
  /** Moves the post, its brief, images and threads somewhere they can be restored from. */
  remove(slug: string): Promise<void>;
}

/** The site as `astro dev` serves it, for the preview view. */
export interface Preview {
  /** Resolves once the server answers. Rejects with Astro's output if it fails to start. */
  origin(): Promise<string>;
  stop(): void;
}

/** Each post's threads, in writing/threads/<slug>.json. Callers check slugs with `isSlug` first. */
export interface ThreadStore {
  /** An empty list when the post has no threads yet. */
  load(slug: string): Promise<Thread[]>;
  save(slug: string, threads: Thread[]): Promise<void>;
}

export interface Clock {
  now(): Date;
  /** A new unique id (eg for a thread). */
  id(): string;
}
