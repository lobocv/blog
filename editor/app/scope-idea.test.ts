import { describe, expect, it } from 'vitest';
import { PAGE } from '../domain/thread.ts';
import { scopeIdea } from './scope-idea.ts';
import { FakeClock, MemoryIdeasFile, MemoryPostLibrary, MemoryThreadStore } from './testing/fakes.ts';

const md = '## Ideas\n\n- 2026-11-21: [trellis] Topic graph\n- 2026-11-19: Review symptoms\n';

function setup(posts: Record<string, string> = {}) {
  const deps = { library: new MemoryPostLibrary(posts), threads: new MemoryThreadStore(), clock: new FakeClock(), ideas: new MemoryIdeasFile(md) };
  return { ...deps, scope: scopeIdea(deps) };
}

describe('scopeIdea', () => {
  it('starts a draft, takes the idea off the list and asks for /scope in the page thread', async () => {
    const { scope, library, threads, ideas } = setup();
    const started = await scope({ date: '2026-11-21', text: 'Topic graph', series: 'trellis' }, 'How the topic graph works');
    expect(started).toEqual({ slug: 'how_the_topic_graph_works', threadId: PAGE });
    expect((await library.read('how_the_topic_graph_works'))?.text).toContain('draft: true');
    expect(ideas.text).toBe('## Ideas\n\n- 2026-11-19: Review symptoms\n');
    const [page] = await threads.load('how_the_topic_graph_works');
    expect(page.messages.map((m) => [m.author, m.text])).toEqual([['calvin', '/scope [trellis] Topic graph']]);
  });

  it('keeps the idea when the title is taken', async () => {
    const { scope, ideas } = setup({ review_symptoms: '---\ntitle: Taken\n---\n' });
    await expect(scope({ date: '2026-11-19', text: 'Review symptoms' }, 'Review symptoms')).rejects.toThrow('already a post');
    expect(ideas.text).toBe(md);
  });
});
