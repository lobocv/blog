import { describe, expect, it } from 'vitest';
import { deleteDraft } from '../app/delete-draft.ts';
import { createDraft } from '../app/create-draft.ts';
import { addIdea, listIdeas, removeIdea } from '../app/ideas.ts';
import { listPosts } from '../app/list-posts.ts';
import { openPost } from '../app/open-post.ts';
import { savePost } from '../app/save-post.ts';
import { scopeIdea } from '../app/scope-idea.ts';
import { chooseLink } from '../app/choose-link.ts';
import { FakeAgent, FakeClock, FakeLiveChecker, FakeRenderer, MemoryIdeasFile, MemoryShortLinks, MemoryPostLibrary, MemoryShareStore, MemoryThreadStore } from '../app/testing/fakes.ts';
import { markPosted, unmarkPosted } from '../app/mark-posted.ts';
import { openShare, preflight } from '../app/open-share.ts';
import { copiedSocialPost, restoreSocialPost, saveSocialPost } from '../app/save-social-post.ts';
import { renderShareImage, shareImage } from '../app/render-share-image.ts';
import { createShareConversation } from '../app/share-conversation.ts';
import { settleSuggestion } from '../app/suggestions.ts';
import { addComment, listThreads, replyToThread, resolveThread } from '../app/threads.ts';
import { watchPost } from '../app/watch-post.ts';
import type { ConversationEvent } from '../app/conversation.ts';
import { createApi, type UseCases } from './http.ts';

const draft = '---\ntitle: A draft\ndraft: true\n---\none two';

function setup() {
  const lib = new MemoryPostLibrary({ a: draft, live: '---\ndraft: false\n---\n' });
  const ideasFile = new MemoryIdeasFile('## Ideas\n\n- 2026-11-21: Old\n');
  const deps = { library: lib, threads: new MemoryThreadStore(), clock: new FakeClock(), share: new MemoryShareStore(), links: new MemoryShortLinks() };
  const checker = new FakeLiveChecker({ 'https://www.lobocv.com/posts/live/': [{ ok: false, message: 'og:image: missing' }] });
  const asked: [string, string][] = [];
  const listeners = new Set<(e: ConversationEvent) => void>();
  const conversation = {
    ask: async (slug: string, id: string) => void asked.push([slug, id]),
    stop: () => {},
    changed: () => {},
    subscribe: (_: string, l: (e: ConversationEvent) => void) => (listeners.add(l), () => listeners.delete(l)),
  };
  const uc: UseCases = {
    conversation,
    listPosts: listPosts(lib),
    createDraft: createDraft(lib, deps.clock),
    listIdeas: listIdeas(ideasFile),
    addIdea: addIdea(ideasFile, deps.clock),
    removeIdea: removeIdea(ideasFile),
    scopeIdea: scopeIdea({ ...deps, ideas: ideasFile }),
    openPost: openPost(lib),
    savePost: savePost(lib, deps.threads),
    deleteDraft: deleteDraft(lib),
    listThreads: listThreads(deps),
    addComment: addComment(deps),
    replyToThread: replyToThread(deps),
    resolveThread: resolveThread(deps),
    settleSuggestion: settleSuggestion(deps),
    watchPost: watchPost(lib),
    previewOrigin: async () => 'http://127.0.0.1:4402',
    watchFigures: () => () => {},
    openShare: openShare(deps),
    preflight: preflight({ ...deps, checker }),
    chooseLink: chooseLink({ ...deps, randomBytes: (n) => new Uint8Array(n) }),
    saveSocialPost: saveSocialPost(deps),
    copiedSocialPost: copiedSocialPost(deps),
    restoreSocialPost: restoreSocialPost(deps),
    markPosted: markPosted(deps),
    unmarkPosted: unmarkPosted(deps),
    renderShareImage: renderShareImage({ ...deps, renderer: new FakeRenderer(), origin: async () => 'http://127.0.0.1:4402' }),
    shareImage: shareImage(deps),
    shareConversation: createShareConversation({ ...deps, threads: new MemoryThreadStore(), agent: new FakeAgent(['On it.']) }),
  };
  return { lib, uc, asked, listeners, share: deps.share, api: createApi(uc) };
}

const put = (body: unknown) => ({ method: 'PUT', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

describe('editor API', () => {
  it('starts a draft, and refuses a title already taken', async () => {
    const { api, lib } = setup();
    const post = (title: string) => api.request('/api/posts', { method: 'POST', body: JSON.stringify({ title }), headers: { 'content-type': 'application/json' } });
    const res = await post('New idea');
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ slug: 'new_idea' });
    expect((await lib.read('new_idea'))?.text).toContain('draft: true');
    expect((await post('New idea')).status).toBe(409);
  });

  it('starts a draft from an idea and asks Claude to run /scope in its page thread', async () => {
    const { api, lib, asked } = setup();
    const send = (body: unknown) => api.request('/api/ideas/scope', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
    const res = await send({ idea: { date: '2026-11-21', text: 'Old' }, title: 'Old idea' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ slug: 'old_idea' });
    expect(await lib.read('old_idea')).toBeDefined();
    expect(asked).toEqual([['old_idea', 'page']]);
    expect((await send({ title: 'No idea' })).status).toBe(400);
  });

  it('lists, adds and removes ideas', async () => {
    const { api } = setup();
    const send = (method: string, body: unknown) => api.request('/api/ideas', { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
    expect(await (await api.request('/api/ideas')).json()).toEqual({ ideas: [{ date: '2026-11-21', text: 'Old' }] });
    const added = await send('POST', { text: 'New' });
    expect(added.status).toBe(201);
    expect((await added.json()).ideas.map((i: { text: string }) => i.text)).toEqual(['New', 'Old']);
    expect(await (await send('DELETE', { date: '2026-11-21', text: 'Old' })).json()).toEqual({ ideas: [{ date: '2026-11-25', text: 'New' }] });
    expect((await send('POST', { text: ' ' })).status).toBe(409);
  });

  it('lists posts', async () => {
    const res = await setup().api.request('/api/posts');
    expect((await res.json()).posts[0]).toEqual({ slug: 'a', title: 'A draft', draft: true, words: 2, minutes: 1, modified: '1970-01-01T00:00:00.000Z' });
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
    expect(new TextDecoder().decode((await reader.read()).value)).toBe(': open\n\n');
    const chunk = new TextDecoder().decode((await reader.read()).value);
    expect(chunk).toBe('data: {"type":"working","threadId":"t1","text":"Hi"}\n\n');
    await reader.cancel();
  });

  it('streams edits made outside the editor', async () => {
    const { api, lib } = setup();
    const res = await api.request('/api/posts/a/events');
    const reader = res.body!.getReader();
    await new Promise((r) => setTimeout(r, 0));
    lib.editOutside('a', 'changed');
    await reader.read(); // ': open'
    const chunk = new TextDecoder().decode((await reader.read()).value);
    expect(chunk).toBe('data: {"type":"outside","text":"changed"}\n\n');
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

  describe('share page', () => {
    const send = (method: string, body?: unknown) => ({ method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'content-type': 'application/json' } });

    it('opens a published post, and refuses a draft', async () => {
      const { api } = setup();
      const res = await api.request('/api/share/live');
      expect(await res.json()).toMatchObject({ post: { slug: 'live', postUrl: 'https://www.lobocv.com/posts/live/' }, state: { networks: { linkedin: { text: '' } } } });
      expect((await api.request('/api/share/a')).status).toBe(409);
      expect((await api.request('/api/share/missing')).status).toBe(404);
    });

    it('runs pre-flight on its own route', async () => {
      expect(await (await setup().api.request('/api/share/live/preflight')).json()).toEqual({ checks: [{ ok: false, message: 'og:image: missing' }] });
    });

    it('saves, copies, restores and marks posted', async () => {
      const { api, share } = setup();
      const state = async (res: Response) => (await res.json()).state.networks.linkedin;
      expect(await state(await api.request('/api/share/live/linkedin', send('PUT', { text: 'One.' })))).toMatchObject({ text: 'One.' });
      expect(share.texts.get('live')?.linkedin).toMatch(/^One\./);
      expect(await state(await api.request('/api/share/live/linkedin/copied', send('POST', { text: 'Two.' })))).toMatchObject({ status: 'ready', versions: [{ text: 'Two.' }] });
      expect(await state(await api.request('/api/share/live/linkedin/restore', send('POST', { index: 0, current: { text: 'Three.' } })))).toMatchObject({ text: 'Two.' });
      expect(await state(await api.request('/api/share/live/linkedin/posted', send('POST', { url: 'https://www.linkedin.com/feed/update/1/' })))).toMatchObject({ status: 'posted' });
      expect(await state(await api.request('/api/share/live/linkedin/posted', send('DELETE')))).toMatchObject({ status: 'ready' });
    });

    it('renders the image, serves it, and offers it as a download', async () => {
      const { api } = setup();
      expect((await api.request('/api/share/live/linkedin/image')).status).toBe(404);
      const rendered = await api.request('/api/share/live/linkedin/image', send('POST', {}));
      expect((await rendered.json()).state.networks.linkedin.rendered).toMatchObject({ shape: 'landscape', width: 1200, height: 628 });
      const png = await api.request('/api/share/live/linkedin/image');
      expect(png.headers.get('content-type')).toBe('image/png');
      expect((await png.arrayBuffer()).byteLength).toBe(24);
      const saved = await api.request('/api/share/live/linkedin/image?download=1');
      expect(saved.headers.get('content-disposition')).toBe('attachment; filename="live-linkedin.png"');
    });

    it('switches to a short link and back', async () => {
      const { api } = setup();
      const short = await api.request('/api/share/live/linkedin/link', send('POST', { kind: 'short' }));
      expect((await short.json()).state.networks.linkedin.link).toEqual({ kind: 'short', code: 'aaaaaa' });
      const tagged = await api.request('/api/share/live/linkedin/link', send('POST', { kind: 'tagged' }));
      expect((await tagged.json()).state.networks.linkedin.link).toEqual({ kind: 'tagged', code: 'aaaaaa' });
      expect((await api.request('/api/share/live/linkedin/link', send('POST', { kind: 'long' }))).status).toBe(400);
    });

    it('saves an image choice', async () => {
      const { api } = setup();
      const res = await api.request('/api/share/live/linkedin', send('PUT', { media: { kind: 'image', figure: { kind: 'component', source: 'src/components/post/T.astro' }, theme: 'night', alt: 'A tree.' } }));
      expect((await res.json()).state.networks.linkedin.media).toEqual({ kind: 'image', figure: { kind: 'component', source: 'src/components/post/T.astro' }, theme: 'night', alt: 'A tree.' });
    });

    it('passes a message to Claude in the share thread, and streams its reply and new state', async () => {
      const { api, uc } = setup();
      const res = await api.request('/api/share/live/events');
      const reader = res.body!.getReader();
      await reader.read(); // ': open'
      const sent = await api.request('/api/share/live/thread', send('POST', { text: 'Draft the LinkedIn post.' }));
      expect((await sent.json()).threads[0].messages[0]).toMatchObject({ author: 'calvin', text: 'Draft the LinkedIn post.' });
      const seen: string[] = [];
      while (!seen.includes('idle')) {
        for (const line of new TextDecoder().decode((await reader.read()).value).split('\n')) {
          if (line.startsWith('data: ')) seen.push(JSON.parse(line.slice(6)).type);
        }
      }
      expect(seen).toContain('threads');
      const thread = await (await api.request('/api/share/live/thread')).json();
      expect(thread.threads[0].messages.map((m: { text: string }) => m.text)).toEqual(['Draft the LinkedIn post.', 'On it.']);
      expect((await api.request('/api/share/live/thread', send('POST', { text: '' }))).status).toBe(400);
      expect((await api.request('/api/share/a/thread', send('POST', { text: 'hi' }))).status).toBe(409);
      expect((await api.request('/api/share/live/stop', send('POST', {}))).status).toBe(204);
      await reader.cancel();
      void uc;
    });

    it.each([
      ['PUT', '/api/share/live/linkedin', { text: 1 }, 400],
      ['PUT', '/api/share/live/linkedin', { media: { kind: 'video' } }, 400],
      ['PUT', '/api/share/live/linkedin', { media: { kind: 'image', theme: 'dusk' } }, 400],
      ['PUT', '/api/share/live/nope', { text: 'x' }, 404],
      ['PUT', '/api/share/a/linkedin', { text: 'x' }, 409],
      ['POST', '/api/share/live/linkedin/posted', { url: 'javascript:alert(1)' }, 400],
      ['POST', '/api/share/live/linkedin/restore', { index: -1, current: { text: '' } }, 400],
    ])('%s %s %j is %i', async (method, path, body, status) => {
      expect((await setup().api.request(path, send(method, body))).status).toBe(status);
    });
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
