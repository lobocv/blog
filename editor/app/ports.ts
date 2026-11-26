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
  /**
   * Calls `onOutsideEdit` with the new text whenever something else (eg Zed, or Claude Code in a
   * terminal) changes the post. Its own writes don't count. Returns a function that stops watching.
   */
  watch(slug: string, onOutsideEdit: (text: string) => void): () => void;
}

/** The site as `astro dev` serves it, for the preview view. */
export interface Preview {
  /** Resolves once the server answers. Rejects with Astro's output if it fails to start. */
  origin(): Promise<string>;
  /**
   * Calls `onChange` when a figure's code or styles change (src/components/, src/styles/). Source
   * reloads its figures then, since their pages don't reload by themselves. Returns a function that stops.
   */
  watchFigures(onChange: () => void): () => void;
  stop(): void;
}

/** Each post's threads, in writing/threads/<slug>.json. Callers check slugs with `isSlug` first. */
export interface ThreadStore {
  /** An empty list when the post has no threads yet. */
  load(slug: string): Promise<Thread[]>;
  save(slug: string, threads: Thread[]): Promise<void>;
  /** The Claude session for the post, so each turn resumes the same conversation. */
  session(slug: string): Promise<string | undefined>;
  saveSession(slug: string, session: string): Promise<void>;
}

/** writing/ideas.md, where /idea adds post ideas. */
export interface IdeasFile {
  /** An empty string when there is no file yet. */
  read(): Promise<string>;
  write(text: string): Promise<void>;
}

export interface Clock {
  now(): Date;
  /** A new unique id (eg for a thread). */
  id(): string;
}

/** What Claude is doing while it works on a reply. */
export type AgentEvent = { type: 'text'; text: string } | { type: 'tool'; name: string };

/** Claude, run once per turn. */
export interface Agent {
  /**
   * Runs one turn and resolves with the final reply and the session to resume next time.
   * `onEvent` gets the reply as it streams. Aborting `signal` stops Claude and resolves with
   * `stopped: true` and whatever it had written.
   */
  ask(
    turn: { prompt: string; session?: string; /** The editor's MCP tools for this post. */ tools?: string },
    onEvent: (e: AgentEvent) => void,
    signal: AbortSignal,
  ): Promise<{ text: string; session?: string; stopped: boolean }>;
}
