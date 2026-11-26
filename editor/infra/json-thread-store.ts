// Threads and the post's Claude session as writing/threads/<slug>.json: pretty printed, so diffs
// in git are readable.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ThreadStore } from '../app/ports.ts';
import type { Thread } from '../domain/thread.ts';

/** The file's shape. `session` is the post's Claude session id. */
type File = { threads: Thread[]; session?: string };

export class JsonThreadStore implements ThreadStore {
  readonly #root: string;

  constructor(root: string) {
    this.#root = root;
  }

  #path(slug: string) {
    return join(this.#root, 'writing/threads', `${slug}.json`);
  }

  async #read(slug: string): Promise<File> {
    const text = await readFile(this.#path(slug), 'utf8').catch((err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') return undefined;
      throw err;
    });
    return text === undefined ? { threads: [] } : { threads: [], ...(JSON.parse(text) as Partial<File>) };
  }

  async load(slug: string): Promise<Thread[]> {
    return (await this.#read(slug)).threads;
  }

  async save(slug: string, threads: Thread[]) {
    await this.#write(slug, { ...(await this.#read(slug)), threads });
  }

  async session(slug: string) {
    return (await this.#read(slug)).session;
  }

  async saveSession(slug: string, session: string) {
    await this.#write(slug, { ...(await this.#read(slug)), session });
  }

  // Temporary file then rename, so a crash mid-write never leaves half a file.
  async #write(slug: string, file: File) {
    const { threads, session } = file;
    const path = this.#path(slug);
    await mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.${process.pid}.tmp`;
    await writeFile(tmp, `${JSON.stringify({ threads, session }, null, 2)}\n`, 'utf8');
    await rename(tmp, path);
  }
}
