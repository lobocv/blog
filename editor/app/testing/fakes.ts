// In-memory versions of every port in ../ports.ts, for use-case tests. The
// contract suites in infra/contracts/ run against these too, so they behave
// like the real adapters.
import type { PostFile } from '../../domain/post.ts';
import type { Thread } from '../../domain/thread.ts';
import type { Agent, AgentEvent, Clock, IdeasFile, PostLibrary, ThreadStore } from '../ports.ts';

export class MemoryPostLibrary implements PostLibrary {
  posts = new Map<string, PostFile>();
  removed: string[] = [];
  writes: [string, string][] = [];

  constructor(posts: Record<string, string> = {}) {
    for (const [slug, text] of Object.entries(posts)) this.posts.set(slug, { slug, text, modified: new Date(0) });
  }

  async list() {
    return [...this.posts.values()].sort((a, b) => a.slug.localeCompare(b.slug));
  }

  async read(slug: string) {
    return this.posts.get(slug);
  }

  pathOf(slug: string) {
    return `src/content/posts/${slug}/index.md`;
  }

  async write(slug: string, text: string) {
    this.posts.set(slug, { slug, text, modified: new Date() });
    this.writes.push([slug, text]);
  }

  async remove(slug: string) {
    this.posts.delete(slug);
    this.removed.push(slug);
  }

  #watchers = new Map<string, Set<(text: string) => void>>();

  watch(slug: string, onOutsideEdit: (text: string) => void) {
    const set = this.#watchers.get(slug) ?? new Set();
    this.#watchers.set(slug, set.add(onOutsideEdit));
    return () => void set.delete(onOutsideEdit);
  }

  /** Changes a post the way another program would, telling watchers. */
  editOutside(slug: string, text: string) {
    this.posts.set(slug, { slug, text, modified: new Date() });
    for (const w of this.#watchers.get(slug) ?? []) w(text);
  }
}

export class MemoryThreadStore implements ThreadStore {
  threads = new Map<string, Thread[]>();
  sessions = new Map<string, string>();

  async session(slug: string) {
    return this.sessions.get(slug);
  }

  async saveSession(slug: string, session: string) {
    this.sessions.set(slug, session);
  }

  async load(slug: string) {
    return structuredClone(this.threads.get(slug) ?? []);
  }

  async save(slug: string, threads: Thread[]) {
    this.threads.set(slug, structuredClone(threads));
  }
}

/** Starts at 2026-11-25 12:00 UTC and gives ids t1, t2, ... */
export class FakeClock implements Clock {
  time = new Date('2026-11-25T12:00:00Z');
  #ids = 0;

  now() {
    return this.time;
  }

  id() {
    return `t${++this.#ids}`;
  }
}

/**
 * Replies with the next scripted reply, streamed a word at a time. A reply of `wait` holds the
 * turn open until `release()` is called (or the turn is stopped), to test queueing and stopping.
 */
export class FakeAgent implements Agent {
  turns: { prompt: string; session?: string; tools?: string }[] = [];
  #replies: string[];
  #release: (() => void) | undefined;

  constructor(replies: string[]) {
    this.#replies = replies;
  }

  release() {
    this.#release?.();
  }

  async ask(turn: { prompt: string; session?: string; tools?: string }, onEvent: (e: AgentEvent) => void, signal: AbortSignal) {
    this.turns.push(turn);
    const reply = this.#replies.shift() ?? 'ok';
    const session = `s${this.turns.length}`;
    if (reply === 'wait') {
      onEvent({ type: 'text', text: 'partial' });
      const stopped = await new Promise<boolean>((done) => {
        this.#release = () => done(false);
        signal.addEventListener('abort', () => done(true));
      });
      return { text: stopped ? 'partial' : 'released', session, stopped };
    }
    let text = '';
    for (const word of reply.split(' ')) onEvent({ type: 'text', text: (text += (text ? ' ' : '') + word) });
    return { text: reply, session, stopped: false };
  }
}

export class MemoryIdeasFile implements IdeasFile {
  text: string;

  constructor(text = '') {
    this.text = text;
  }

  async read() {
    return this.text;
  }

  async write(text: string) {
    this.text = text;
  }
}
