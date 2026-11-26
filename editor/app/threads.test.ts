import { describe, expect, it } from 'vitest';
import { PAGE } from '../domain/thread.ts';
import { NotFound } from './errors.ts';
import { savePost } from './save-post.ts';
import { FakeClock, MemoryPostLibrary, MemoryThreadStore } from './testing/fakes.ts';
import { addComment, listThreads, replyToThread, resolveThread } from './threads.ts';

const text = '---\ndraft: true\n---\nOne two.\nThree four.\n';

function setup() {
  const deps = { library: new MemoryPostLibrary({ a: text }), threads: new MemoryThreadStore(), clock: new FakeClock() };
  return { deps, add: addComment(deps), list: listThreads(deps) };
}

describe('thread use cases', () => {
  it('adds a comment and lists it', async () => {
    const { add, list } = setup();
    await add('a', { anchor: { quote: 'Three', line: 5 }, text: 'too short?' });
    expect(await list('a')).toEqual([
      {
        id: 't1',
        anchor: { quote: 'Three', line: 5 },
        resolved: false,
        messages: [{ author: 'calvin', text: 'too short?', at: '2026-11-25T12:00:00.000Z' }],
      },
    ]);
  });

  it('adds comments without an anchor to the page thread', async () => {
    const { add } = setup();
    await add('a', { text: 'overall?' });
    const { threads } = await add('a', { text: 'and the ending?' });
    expect(threads.map((t) => [t.id, t.messages.length])).toEqual([[PAGE, 2]]);
  });

  it('replies to and resolves a thread', async () => {
    const { deps, add } = setup();
    await add('a', { anchor: { quote: 'One', line: 4 }, text: 'x' });
    await replyToThread(deps)('a', 't1', 'y');
    const [t] = await resolveThread(deps)('a', 't1');
    expect(t.resolved).toBe(true);
    expect(t.messages.map((m) => m.text)).toEqual(['x', 'y']);
  });

  it('refuses a missing post or thread', async () => {
    const { deps, add } = setup();
    await expect(add('missing', { text: 'x' })).rejects.toBeInstanceOf(NotFound);
    await expect(replyToThread(deps)('a', 'nope', 'x')).rejects.toBeInstanceOf(NotFound);
    await expect(resolveThread(deps)('a', 'nope')).rejects.toBeInstanceOf(NotFound);
  });

  it('moves anchors along when the post is saved, and marks lost ones', async () => {
    const { deps, add } = setup();
    await add('a', { anchor: { quote: 'Three', line: 5 }, text: 'x' });
    await add('a', { anchor: { quote: 'One two', line: 4 }, text: 'y' });
    await savePost(deps.library, deps.threads)('a', '---\ndraft: true\n---\nNew line.\n\nThree four.\n');
    const [three, gone] = await deps.threads.load('a');
    expect(three.anchor!.line).toBe(6);
    expect(gone.lost).toBe(true);
  });
});
