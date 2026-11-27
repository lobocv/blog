// Starts the writing editor: `make write` or `node editor/main.ts [--post <slug|path>]`.
// Wires adapters into use cases and starts the servers. No logic of its own.
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { serve } from '@hono/node-server';
import preact from '@preact/preset-vite';
import { createServer } from 'vite';
import { createConversation } from './app/conversation.ts';
import { deleteDraft } from './app/delete-draft.ts';
import { createDraft } from './app/create-draft.ts';
import { addIdea, listIdeas, removeIdea } from './app/ideas.ts';
import { listPosts } from './app/list-posts.ts';
import { openPost } from './app/open-post.ts';
import { savePost } from './app/save-post.ts';
import { reportReview } from './app/review.ts';
import { settleSuggestion, suggestEdit } from './app/suggestions.ts';
import { addComment, listThreads, replyToThread, resolveThread } from './app/threads.ts';
import { watchPost } from './app/watch-post.ts';
import { markPosted, unmarkPosted } from './app/mark-posted.ts';
import { openShare, preflight } from './app/open-share.ts';
import { copiedSocialPost, restoreSocialPost, saveSocialPost } from './app/save-social-post.ts';
import { FsShareStore } from './infra/fs-share-store.ts';
import { HttpLiveChecker } from './infra/live-checker.ts';
import { PlaywrightRenderer } from './infra/figure-renderer.ts';
import { renderShareImage, shareImage } from './app/render-share-image.ts';
import { AstroPreview } from './infra/astro-preview.ts';
import { FsIdeasFile } from './infra/fs-ideas-file.ts';
import { ClaudeAgent } from './infra/claude-agent.ts';
import { FsPostLibrary } from './infra/fs-post-library.ts';
import { JsonThreadStore } from './infra/json-thread-store.ts';
import { createMcpHandler } from './infra/mcp-tools.ts';
import { createApi } from './server/http.ts';

const { values: args } = parseArgs({
  options: {
    post: { type: 'string' },
    port: { type: 'string', default: '4400' },
    open: { type: 'boolean', default: false },
    // --no-preview skips starting astro dev (eg for tests on a repo without Astro).
    preview: { type: 'boolean', default: true },
    // The claude executable. Tests pass a fake that replays a recorded stream.
    claude: { type: 'string', default: 'claude' },
    // The repo to edit. Tests point it at a temporary copy.
    root: { type: 'string', default: resolve(import.meta.dirname, '..') },
    // Where pre-flight checks the live page. Tests point it at a local server. Links stay on the real site.
    'check-origin': { type: 'string' },
  },
  allowNegative: true,
});

const port = Number(args.port);
const apiPort = port + 1;
const root = resolve(args.root);

const preview = args.preview ? new AstroPreview(root, port + 2) : undefined;
const renderer = new PlaywrightRenderer();
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    preview?.stop();
    void renderer.close().finally(() => process.exit(0));
  });
}

const library = new FsPostLibrary(root);
const threads = new JsonThreadStore(root);
const ideasFile = new FsIdeasFile(root);
const share = { library, share: new FsShareStore(root), clock: { now: () => new Date(), id: randomUUID } };
const deps = { library, threads, clock: { now: () => new Date(), id: randomUUID } };
const conversation = createConversation({
  ...deps,
  agent: new ClaudeAgent(root, args.claude),
  toolsUrl: (slug) => `http://127.0.0.1:${apiPort}/mcp/${slug}`,
});
const mcp = createMcpHandler({ suggestEdit: suggestEdit(deps), reportReview: reportReview(deps), changed: conversation.changed });
const api = createApi({
  listPosts: listPosts(library),
  createDraft: createDraft(library, deps.clock),
  listIdeas: listIdeas(ideasFile),
  addIdea: addIdea(ideasFile, deps.clock),
  removeIdea: removeIdea(ideasFile),
  openPost: openPost(library),
  savePost: savePost(library, threads),
  listThreads: listThreads(deps),
  addComment: addComment(deps),
  replyToThread: replyToThread(deps),
  resolveThread: resolveThread(deps),
  settleSuggestion: settleSuggestion(deps),
  watchPost: watchPost(library),
  deleteDraft: deleteDraft(library),
  conversation,
  previewOrigin: () => preview?.origin() ?? Promise.reject(new Error('The preview is off (--no-preview).')),
  watchFigures: (onChange) => preview?.watchFigures(onChange) ?? (() => {}),
  openShare: openShare(share),
  preflight: preflight({ library, checker: new HttpLiveChecker(), origin: args['check-origin'] }),
  saveSocialPost: saveSocialPost(share),
  copiedSocialPost: copiedSocialPost(share),
  restoreSocialPost: restoreSocialPost(share),
  markPosted: markPosted(share),
  unmarkPosted: unmarkPosted(share),
  renderShareImage: renderShareImage({
    ...share,
    renderer,
    origin: () => preview?.origin() ?? Promise.reject(new Error("The preview is off (--no-preview), so images can't be rendered.")),
  }),
  shareImage: shareImage(share),
});

// Claude reaches the MCP tools on the API port directly, not through the UI's proxy.
api.all('/mcp/:slug', (c) => mcp(c.req.param('slug'), c.req.raw));
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
