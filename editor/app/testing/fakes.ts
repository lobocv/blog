// In-memory versions of every port in ../ports.ts, for use-case tests. The
// contract suites in infra/contracts/ run against these too, so they behave
// like the real adapters.
import type { PostFile } from '../../domain/post.ts';
import type { Thread } from '../../domain/thread.ts';
import type { ShareState } from '../../domain/social/social-post.ts';
import { Refused } from '../errors.ts';
import type { Size } from '../../domain/social/network.ts';
import type { Theme } from '../../domain/social/social-post.ts';
import type { Agent, AgentEvent, AgentTurn, Clock, IdeasFile, ImageRenderer, LiveCheck, LiveChecker, PostLibrary, RenderTarget, ShareStore, ShareUpdate, ThreadStore } from '../ports.ts';

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
  turns: AgentTurn[] = [];
  #replies: string[];
  #release: (() => void) | undefined;

  constructor(replies: string[]) {
    this.#replies = replies;
  }

  release() {
    this.#release?.();
  }

  async ask(turn: AgentTurn, onEvent: (e: AgentEvent) => void, signal: AbortSignal) {
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

export class MemoryShareStore implements ShareStore {
  states = new Map<string, ShareState>();
  /** The ready-to-paste files, by slug then network id. */
  texts = new Map<string, Record<string, string>>();
  /** Slugs whose saved state can't be read. */
  broken = new Set<string>();
  images = new Map<string, Uint8Array>();

  async writeImage(slug: string, network: string, png: Uint8Array) {
    this.images.set(`${slug}/${network}`, new Uint8Array(png));
  }

  async readImage(slug: string, network: string) {
    const png = this.images.get(`${slug}/${network}`);
    return png && new Uint8Array(png);
  }

  async load(slug: string) {
    if (this.broken.has(slug)) throw new Refused(`writing/share/${slug}/share.json can't be read.`);
    const s = this.states.get(slug);
    return s && structuredClone(s);
  }

  #queue = new Map<string, Promise<unknown>>();

  update(slug: string, change: (current: ShareState | undefined) => ShareUpdate) {
    const run = async () => {
      const { state, texts } = change(await this.load(slug));
      this.states.set(slug, structuredClone(state));
      this.texts.set(slug, { ...texts });
      return structuredClone(state);
    };
    const next = (this.#queue.get(slug) ?? Promise.resolve()).then(run, run);
    this.#queue.set(slug, next);
    return next;
  }
}

/**
 * Answers with the results set for each URL. Any other URL fails, as an unreachable page would.
 * Records the URLs it was asked about.
 */
export class FakeLiveChecker implements LiveChecker {
  urls: string[] = [];
  results: Record<string, LiveCheck[]>;

  constructor(results: Record<string, LiveCheck[]> = {}) {
    this.results = results;
  }

  async check(url: string) {
    this.urls.push(url);
    return structuredClone(this.results[url] ?? [{ ok: false, message: 'page loads: unreachable' }]);
  }
}

/** The start of a PNG: the signature and the header chunk, which holds the size. Enough to read back its size. */
export function pngHeader({ width, height }: Size): Uint8Array {
  const out = new Uint8Array(24);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(out.buffer).setUint32(16, width);
  new DataView(out.buffer).setUint32(20, height);
  return out;
}

/** "Renders" every figure as `figure` sized, recording what it was asked. Rejects with `fail` when set. */
export class FakeRenderer implements ImageRenderer {
  calls: { target: RenderTarget; theme: Theme }[] = [];
  figure: Size;
  fail: Error | undefined;

  constructor(figure: Size = { width: 680, height: 340 }) {
    this.figure = figure;
  }

  async render(target: RenderTarget, options: { theme: Theme; size: (figure: Size) => Size }) {
    this.calls.push({ target, theme: options.theme });
    if (this.fail) throw this.fail;
    return { png: pngHeader(options.size(this.figure)), figure: this.figure };
  }
}
