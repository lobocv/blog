// Threads as writing/threads/<slug>.json: pretty printed, so diffs in git are readable.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ThreadStore } from '../app/ports.ts';
import type { Thread } from '../domain/thread.ts';

export class JsonThreadStore implements ThreadStore {
  readonly #root: string;

  constructor(root: string) {
    this.#root = root;
  }

  #path(slug: string) {
    return join(this.#root, 'writing/threads', `${slug}.json`);
  }

  async load(slug: string): Promise<Thread[]> {
    const text = await readFile(this.#path(slug), 'utf8').catch((err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') return undefined;
      throw err;
    });
    if (text === undefined) return [];
    const data = JSON.parse(text) as { threads?: Thread[] };
    return data.threads ?? [];
  }

  // Temporary file then rename, so a crash mid-write never leaves half a file.
  async save(slug: string, threads: Thread[]) {
    const path = this.#path(slug);
    await mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.${process.pid}.tmp`;
    await writeFile(tmp, `${JSON.stringify({ threads }, null, 2)}\n`, 'utf8');
    await rename(tmp, path);
  }
}
