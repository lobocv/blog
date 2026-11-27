// What the use cases need from the outside world. Adapters in infra/ implement
// these, and testing/fakes.ts has an in-memory version of each.
import type { PostFile } from '../domain/post.ts';
import type { Size } from '../domain/social/network.ts';
import type { ShareState, Theme } from '../domain/social/social-post.ts';
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

/** A change to a post's share state: the new state, and the ready-to-paste text per network id. */
export type ShareUpdate = { state: ShareState; texts: Record<string, string> };

/**
 * Each published post's share state, in writing/share/<slug>/: share.json, and a <network>.txt per
 * network that's always ready to paste. Callers check slugs with `isSlug` first.
 */
export interface ShareStore {
  /**
   * Undefined when the post hasn't been shared yet. Rejects with Refused when the saved state
   * can't be read (eg broken JSON, or a newer format), so nothing overwrites it.
   */
  load(slug: string): Promise<ShareState | undefined>;
  /**
   * `change` gets the current state and returns the new one. Updates to the same post run one at
   * a time, each seeing the last one's result, so none is lost.
   */
  update(slug: string, change: (current: ShareState | undefined) => ShareUpdate): Promise<ShareState>;
  /** Writes a network's rendered image, <network>.png. */
  writeImage(slug: string, network: string, png: Uint8Array): Promise<void>;
  /** Undefined when the network has no rendered image yet. */
  readImage(slug: string, network: string): Promise<Uint8Array | undefined>;
}

/**
 * What to render: `page` is the preview server's page for one figure (/_editor/figure). With
 * `image`, the page shows that image (on the same server) in place of a component.
 */
export type RenderTarget = { page: string; image?: string };

/** Renders a figure to a PNG, the way it looks in the post. */
export interface ImageRenderer {
  /**
   * `size` gets the figure's own size, as laid out in the post's column, and returns the PNG's
   * size; the figure is centred and padded to fill it. Resolves with the PNG and the figure's size.
   */
  render(target: RenderTarget, options: { theme: Theme; size: (figure: Size) => Size }): Promise<{ png: Uint8Array; figure: Size }>;
}

/** One pre-flight result, eg { ok: true, message: 'og:title: ...' }. */
export type LiveCheck = { ok: boolean; message: string };

/** Pre-flight against the deployed site. For information only: it never blocks anything. */
export interface LiveChecker {
  /** Never rejects: a page that doesn't load is a failed check. */
  check(url: string): Promise<LiveCheck[]>;
}
