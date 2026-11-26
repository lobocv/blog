// Starts the writing editor: `make write` or `node editor/main.ts [--post <slug|path>]`.
// Wires adapters into use cases and starts the servers. No logic of its own.
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { serve } from '@hono/node-server';
import preact from '@preact/preset-vite';
import { createServer } from 'vite';
import { deleteDraft } from './app/delete-draft.ts';
import { listDrafts } from './app/list-drafts.ts';
import { openPost } from './app/open-post.ts';
import { savePost } from './app/save-post.ts';
import { addComment, listThreads, replyToThread, resolveThread } from './app/threads.ts';
import { AstroPreview } from './infra/astro-preview.ts';
import { FsPostLibrary } from './infra/fs-post-library.ts';
import { JsonThreadStore } from './infra/json-thread-store.ts';
import { createApi } from './server/http.ts';

const { values: args } = parseArgs({
  options: {
    post: { type: 'string' },
    port: { type: 'string', default: '4400' },
    open: { type: 'boolean', default: false },
    // --no-preview skips starting astro dev (eg for tests on a repo without Astro).
    preview: { type: 'boolean', default: true },
    // The repo to edit. Tests point it at a temporary copy.
    root: { type: 'string', default: resolve(import.meta.dirname, '..') },
  },
  allowNegative: true,
});

const port = Number(args.port);
const apiPort = port + 1;
const root = resolve(args.root);

const preview = args.preview ? new AstroPreview(root, port + 2) : undefined;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    preview?.stop();
    process.exit(0);
  });
}

const library = new FsPostLibrary(root);
const threads = new JsonThreadStore(root);
const deps = { library, threads, clock: { now: () => new Date(), id: randomUUID } };
const api = createApi({
  listDrafts: listDrafts(library),
  openPost: openPost(library),
  savePost: savePost(library, threads),
  listThreads: listThreads(deps),
  addComment: addComment(deps),
  replyToThread: replyToThread(deps),
  resolveThread: resolveThread(deps),
  deleteDraft: deleteDraft(library),
  previewOrigin: () => preview?.origin() ?? Promise.reject(new Error('The preview is off (--no-preview).')),
});

serve({ fetch: api.fetch, port: apiPort, hostname: '127.0.0.1' });

const ui = await createServer({
  configFile: false,
  root: join(import.meta.dirname, 'ui'),
  plugins: [preact()],
  logLevel: 'warn',
  server: { host: '127.0.0.1', port, strictPort: true, proxy: { '/api/': `http://127.0.0.1:${apiPort}` } },
});
await ui.listen();

const url = `http://127.0.0.1:${port}/${args.post ? `?post=${encodeURIComponent(args.post)}` : ''}`;
console.log(url);

if (args.open) {
  // Its own window when Chrome is installed, otherwise the default browser.
  execFile('open', ['-na', 'Google Chrome', '--args', `--app=${url}`], (err) => {
    if (err) execFile('open', [url]);
  });
}
