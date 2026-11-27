// Each post's share state as writing/share/<slug>/: share.json (pretty printed, so it reads well in
// a diff, since the folder is committed) and a ready-to-paste <network>.txt per network.
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { Refused } from '../app/errors.ts';
import type { ShareStore, ShareUpdate } from '../app/ports.ts';
import { SCHEMA_VERSION, type ShareState } from '../domain/social/social-post.ts';

// The file's shape. Loose objects keep fields this version doesn't know (eg ones a later milestone
// adds), and defaults fill in fields older files lack.
const Version = z.looseObject({ text: z.string(), hashtags: z.array(z.string()).default([]), author: z.enum(['calvin', 'claude']).default('calvin'), at: z.string() });
const Post = z.looseObject({
  text: z.string().default(''),
  hashtags: z.array(z.string()).optional(),
  // Any kind, so a choice a later version made survives; resolvePost falls back for kinds it doesn't offer.
  media: z.looseObject({ kind: z.string() }).optional(),
  link: z.looseObject({ kind: z.string() }).optional(),
  status: z.enum(['draft', 'ready', 'posted']).default('draft'),
  versions: z.array(Version).default([]),
  posted: z.looseObject({ url: z.string(), at: z.string(), text: z.string() }).optional(),
});
const File = z.looseObject({ schemaVersion: z.number().int().min(1), networks: z.record(z.string(), Post) });

const isNetworkId = (id: string) => /^[a-z0-9][a-z0-9-]*$/.test(id);

export class FsShareStore implements ShareStore {
  readonly #root: string;
  #queue = new Map<string, Promise<unknown>>();

  constructor(root: string) {
    this.#root = root;
  }

  #dir(slug: string) {
    return join(this.#root, 'writing/share', slug);
  }

  async load(slug: string): Promise<ShareState | undefined> {
    const path = join(this.#dir(slug), 'share.json');
    const text = await readFile(path, 'utf8').catch((err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') return undefined;
      throw err;
    });
    if (text === undefined) return undefined;
    const fix = `Fix or move writing/share/${slug}/share.json.`;
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Refused(`writing/share/${slug}/share.json isn't valid JSON. ${fix}`);
    }
    const parsed = File.safeParse(json);
    if (!parsed.success) throw new Refused(`writing/share/${slug}/share.json doesn't look like share state (${parsed.error.issues[0]?.path.join('.')}). ${fix}`);
    if (parsed.data.schemaVersion > SCHEMA_VERSION) {
      throw new Refused(`writing/share/${slug}/share.json was written by a newer editor (format ${parsed.data.schemaVersion}).`);
    }
    return parsed.data as ShareState;
  }

  update(slug: string, change: (current: ShareState | undefined) => ShareUpdate): Promise<ShareState> {
    const run = async () => {
      const { state, texts } = change(await this.load(slug));
      const bad = Object.keys(texts).find((id) => !isNetworkId(id));
      if (bad) throw new Error(`"${bad}" can't be a file name.`);
      const dir = this.#dir(slug);
      await mkdir(dir, { recursive: true });
      // The texts first: if a write fails part way, share.json still describes the last good state.
      for (const [id, text] of Object.entries(texts)) await this.#write(join(dir, `${id}.txt`), text.endsWith('\n') || !text ? text : `${text}\n`);
      await this.#write(join(dir, 'share.json'), `${JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION }, null, 2)}\n`);
      return structuredClone(state);
    };
    // One at a time per post, each reading what the last one wrote. A failure doesn't stop the queue.
    const next = (this.#queue.get(slug) ?? Promise.resolve()).then(run, run);
    this.#queue.set(slug, next);
    return next;
  }

  // A temporary file then rename, so a crash mid-write never leaves half a file. A unique name per
  // write, so two writes never share one.
  async #write(path: string, text: string) {
    const tmp = `${path}.${randomUUID()}.tmp`;
    await writeFile(tmp, text, 'utf8');
    await rename(tmp, path);
  }
}
