import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { IdeasFile } from '../app/ports.ts';

/** `writing/ideas.md` under the repo `root`. */
export class FsIdeasFile implements IdeasFile {
  readonly #path: string;

  constructor(root: string) {
    this.#path = join(root, 'writing/ideas.md');
  }

  read() {
    return readFile(this.#path, 'utf8').catch((err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') return '';
      throw err;
    });
  }

  // Through a temporary file, so /idea in a terminal never reads a half-written file.
  async write(text: string) {
    await mkdir(dirname(this.#path), { recursive: true });
    const tmp = `${this.#path}.${process.pid}.tmp`;
    await writeFile(tmp, text, 'utf8');
    await rename(tmp, this.#path);
  }
}
