import { describe, expect, it } from 'vitest';
import { deleteDraft } from '../app/delete-draft.ts';
import { listDrafts } from '../app/list-drafts.ts';
import { openPost } from '../app/open-post.ts';
import { savePost } from '../app/save-post.ts';
import { FakeClock, MemoryPostLibrary, MemoryThreadStore } from '../app/testing/fakes.ts';
import { addComment, listThreads, replyToThread, resolveThread } from '../app/threads.ts';
import type { ConversationEvent } from '../app/conversation.ts';
import { createApi, type UseCases } from './http.ts';

const draft = '---\ntitle: A draft\ndraft: true\n---\none two';

function setup() {
  const lib = new MemoryPostLibrary({ a: draft, live: '---\ndraft: false\n---\n' });
  const deps = { library: lib, threads: new MemoryThreadStore(), clock: new FakeClock() };
  const asked: [string, string][] = [];
  const listeners = new Set<(e: ConversationEvent) => void>();
  const conversation = {
    ask: async (slug: string, id: string) => void asked.push([slug, id]),
    stop: () => {},
    subscribe: (_: string, l: (e: ConversationEvent) => void) => (listeners.add(l), () => listeners.delete(l)),
  };
  const uc: UseCases = {
    conversation,
    listDrafts: listDrafts(lib),
    openPost: openPost(lib),
    savePost: savePost(lib, deps.threads),
    deleteDraft: deleteDraft(lib),
    listThreads: listThreads(deps),
    addComment: addComment(deps),
    replyToThread: replyToThread(deps),
    resolveThread: resolveThread(deps),
    previewOrigin: async () => 'http://127.0.0.1:4402',
  };
  return { lib, uc, asked, listeners, api: createApi(uc) };
}

const put = (body: unknown) => ({ method: 'PUT', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

describe('editor API', () => {
  it('lists drafts', async () => {
    const res = await setup().api.request('/api/drafts');
    expect(await res.json()).toEqual({
      drafts: [{ slug: 'a', title: 'A draft', words: 2, minutes: 1, modified: '1970-01-01T00:00:00.000Z' }],
    });
  });

  it('adds, replies to and resolves threads', async () => {
    const { api } = setup();
    const post = (path: string, body?: unknown) =>
      api.request(path, { method: 'POST', body: JSON.stringify(body ?? {}), headers: { 'content-type': 'application/json' } });
    await post('/api/posts/a/threads', { anchor: { quote: 'one', line: 5 }, text: 'why?' });
    await post('/api/posts/a/threads/t1/replies', { text: 'because' });
    await post('/api/posts/a/threads/t1/resolve');
    const { threads } = await (await api.request('/api/posts/a/threads')).json();
    expect(threads).toMatchObject([{ id: 't1', resolved: true, messages: [{ text: 'why?' }, { text: 'because' }] }]);
    expect((await post('/api/posts/a/threads', { text: '' })).status).toBe(400);
    expect((await post('/api/posts/a/threads/nope/resolve')).status).toBe(404);
  });

  it("passes Calvin's comments and replies on to Claude", async () => {
    const { api, asked } = setup();
    const post = (path: string, body: unknown) =>
      api.request(path, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
    await post('/api/posts/a/threads', { anchor: { quote: 'one', line: 5 }, text: 'why?' });
    await post('/api/posts/a/threads/t1/replies', { text: 'and?' });
    await post('/api/posts/a/threads', { text: 'overall?' });
    expect(asked).toEqual([
      ['a', 't1'],
      ['a', 't1'],
      ['a', 'page'],
    ]);
  });

  it("streams Claude's events", async () => {
    const { api, listeners } = setup();
    const res = await api.request('/api/posts/a/events');
    const reader = res.body!.getReader();
    await new Promise((r) => setTimeout(r, 0));
    for (const l of listeners) l({ type: 'working', threadId: 't1', text: 'Hi' });
    const chunk = new TextDecoder().decode((await reader.read()).value);
    expect(chunk).toBe('data: {"type":"working","threadId":"t1","text":"Hi"}\n\n');
    await reader.cancel();
  });

  it('returns the preview origin once Astro answers', async () => {
    const res = await setup().api.request('/api/preview');
    expect(await res.json()).toEqual({ origin: 'http://127.0.0.1:4402' });
  });

  it('returns a post', async () => {
    const res = await setup().api.request('/api/posts/a');
    expect(await res.json()).toEqual({ slug: 'a', name: 'src/content/posts/a/index.md', text: draft });
  });

  it('saves a post', async () => {
    const { api, lib } = setup();
    const res = await api.request('/api/posts/a', put({ text: 'new' }));
    expect(res.status).toBe(204);
    expect(lib.writes).toEqual([['a', 'new']]);
  });

  it('rejects a save without text', async () => {
    const { api, lib } = setup();
    expect((await api.request('/api/posts/a', put({ txt: 'x' }))).status).toBe(400);
    expect(lib.writes).toEqual([]);
  });

  it('deletes a draft', async () => {
    const { api, lib } = setup();
    expect((await api.request('/api/posts/a', { method: 'DELETE' })).status).toBe(204);
    expect(lib.removed).toEqual(['a']);
  });

  it.each([
    ['GET', '/api/posts/missing', 404],
    ['GET', '/api/posts/..%2Fa', 404],
    ['DELETE', '/api/posts/live', 409],
    ['DELETE', '/api/posts/missing', 404],
  ])('%s %s is %i with a message', async (method, path, status) => {
    const res = await setup().api.request(path, { method });
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBeTruthy();
  });

  it('reports a failed save', async () => {
    const failing: UseCases = {
      ...setup().uc,
      savePost: async () => {
        throw new Error('disk full');
      },
    };
    const res = await createApi(failing).request('/api/posts/x', put({ text: 'new' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'disk full' });
  });
});
