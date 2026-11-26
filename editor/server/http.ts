import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Conversation } from '../app/conversation.ts';
import { NotFound, Refused } from '../app/errors.ts';
import type { deleteDraft } from '../app/delete-draft.ts';
import type { listDrafts } from '../app/list-drafts.ts';
import type { openPost } from '../app/open-post.ts';
import type { savePost } from '../app/save-post.ts';
import type { settleSuggestion } from '../app/suggestions.ts';
import type { watchPost } from '../app/watch-post.ts';
import type { addComment, listThreads, replyToThread, resolveThread } from '../app/threads.ts';
import { PostEvent, Drafts, NewComment, NewReply, Post, PreviewInfo, SavePost, Settle, Threads } from '../protocol.ts';

export type UseCases = {
  listDrafts: ReturnType<typeof listDrafts>;
  openPost: ReturnType<typeof openPost>;
  savePost: ReturnType<typeof savePost>;
  deleteDraft: ReturnType<typeof deleteDraft>;
  listThreads: ReturnType<typeof listThreads>;
  addComment: ReturnType<typeof addComment>;
  replyToThread: ReturnType<typeof replyToThread>;
  resolveThread: ReturnType<typeof resolveThread>;
  settleSuggestion: ReturnType<typeof settleSuggestion>;
  watchPost: ReturnType<typeof watchPost>;
  /** Claude's replies. Every comment and reply Calvin sends is passed on to Claude. */
  conversation: Pick<Conversation, 'ask' | 'stop' | 'subscribe'>;
  /** Waits for `astro dev` to answer. */
  previewOrigin: () => Promise<string>;
};

/** Turns requests from the UI into use-case calls. No logic of its own. */
export function createApi(uc: UseCases) {
  const api = new Hono();

  api.get('/api/drafts', async (c) => {
    const drafts = (await uc.listDrafts()).map((d) => ({ ...d, modified: d.modified.toISOString() }));
    return c.json(Drafts.parse({ drafts }));
  });

  api.get('/api/posts/:slug', async (c) => c.json(Post.parse(await uc.openPost(c.req.param('slug')))));

  api.put('/api/posts/:slug', async (c) => {
    const body = SavePost.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'expected { text: string }' }, 400);
    await uc.savePost(c.req.param('slug'), body.data.text);
    return c.body(null, 204);
  });

  api.delete('/api/posts/:slug', async (c) => {
    await uc.deleteDraft(c.req.param('slug'));
    return c.body(null, 204);
  });

  const threads = (list: Threads['threads']) => Threads.parse({ threads: list });

  api.get('/api/posts/:slug/threads', async (c) => c.json(threads(await uc.listThreads(c.req.param('slug')))));

  api.post('/api/posts/:slug/threads', async (c) => {
    const body = NewComment.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'expected { anchor?: { quote, line }, text }' }, 400);
    const slug = c.req.param('slug');
    const added = await uc.addComment(slug, body.data);
    void uc.conversation.ask(slug, added.id);
    return c.json(threads(added.threads));
  });

  api.post('/api/posts/:slug/threads/:id/replies', async (c) => {
    const body = NewReply.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'expected { text }' }, 400);
    const [slug, id] = [c.req.param('slug'), c.req.param('id')];
    const list = await uc.replyToThread(slug, id, body.data.text);
    void uc.conversation.ask(slug, id);
    return c.json(threads(list));
  });

  api.post('/api/posts/:slug/threads/:id/resolve', async (c) =>
    c.json(threads(await uc.resolveThread(c.req.param('slug'), c.req.param('id')))),
  );

  api.post('/api/posts/:slug/suggestions/:id', async (c) => {
    const body = Settle.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected { status: 'accepted' | 'rejected', replace? }" }, 400);
    const { status, replace } = body.data;
    return c.json(threads(await uc.settleSuggestion(c.req.param('slug'), c.req.param('id'), status, replace)));
  });

  api.post('/api/posts/:slug/stop', (c) => {
    uc.conversation.stop(c.req.param('slug'));
    return c.body(null, 204);
  });

  // Claude's work and outside edits, as server-sent events: one `data:` line of PostEvent JSON each.
  api.get('/api/posts/:slug/events', (c) =>
    streamSSE(c, async (stream) => {
      const slug = c.req.param('slug');
      const queue: PostEvent[] = [];
      let wake: (() => void) | undefined;
      const push = (e: PostEvent) => {
        queue.push(e);
        wake?.();
      };
      const stops = [uc.conversation.subscribe(slug, push), uc.watchPost(slug, (text) => push({ type: 'outside', text }))];
      stream.onAbort(() => {
        for (const stop of stops) stop();
        wake?.();
      });
      // A comment line, which EventSource ignores, so the response starts straight away.
      await stream.write(': open\n\n');
      while (!stream.aborted) {
        const e = queue.shift();
        if (e) await stream.writeSSE({ data: JSON.stringify(PostEvent.parse(e)) });
        else await new Promise<void>((r) => (wake = r));
      }
    }),
  );

  api.get('/api/preview', async (c) => c.json(PreviewInfo.parse({ origin: await uc.previewOrigin() })));

  api.onError((err, c) => {
    const status = err instanceof NotFound ? 404 : err instanceof Refused ? 409 : 500;
    return c.json({ error: err.message }, status);
  });

  return api;
}
