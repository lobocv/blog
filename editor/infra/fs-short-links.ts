// The short link codes as src/data/short-links.json, which the blog's build reads. Sorted by code
// and pretty printed, so a new code is a one-line diff.
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { Refused } from '../app/errors.ts';
import type { ShortLinks } from '../app/ports.ts';
import type { ShortLink } from '../domain/social/links.ts';

const File = z.record(z.string(), z.looseObject({ post: z.string(), to: z.string() }));

export class FsShortLinks implements ShortLinks {
  readonly #path: string;
  #queue: Promise<unknown> = Promise.resolve();

  constructor(root: string) {
    this.#path = join(root, 'src/data/short-links.json');
  }

  async all(): Promise<Record<string, ShortLink>> {
    const text = await readFile(this.#path, 'utf8').catch((err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') return '{}';
      throw err;
    });
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Refused("src/data/short-links.json isn't valid JSON. Fix it before adding short links.");
    }
    const parsed = File.safeParse(json);
    if (!parsed.success) throw new Refused("src/data/short-links.json doesn't look like short links. Fix it before adding more.");
    return parsed.data;
  }

  // One at a time, each reading what the last wrote, so adds made at once all land.
  add(code: string, link: ShortLink): Promise<void> {
    const run = async () => {
      const all = await this.all();
      if (code in all) throw new Refused(`The short link code "${code}" is taken.`);
      const next = Object.fromEntries(Object.entries({ ...all, [code]: link }).sort(([a], [b]) => a.localeCompare(b)));
      await mkdir(dirname(this.#path), { recursive: true });
      const tmp = `${this.#path}.${randomUUID()}.tmp`;
      await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`);
      await rename(tmp, this.#path);
    };
    const next = this.#queue.then(run, run);
    this.#queue = next;
    return next;
  }
}
