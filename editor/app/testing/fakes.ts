// In-memory versions of every port in ../ports.ts, for use-case tests. The
// contract suites in infra/contracts/ run against these too, so they behave
// like the real adapters.
import type { PostFile } from '../../domain/post.ts';
import type { Thread } from '../../domain/thread.ts';
import type { Clock, PostLibrary, ThreadStore } from '../ports.ts';

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
}

export class MemoryThreadStore implements ThreadStore {
  threads = new Map<string, Thread[]>();

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
