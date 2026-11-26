import { signal } from '@preact/signals';
import { describe, expect, it } from 'vitest';
import { comment, PAGE, reply, resolve, type Thread } from '../domain/thread.ts';
import { createThreadState } from './thread-state.ts';

const at = '2026-11-25T12:00:00.000Z';

// An in-memory server, using the same domain functions as the real one.
function fakeApi(initial: Thread[] = []) {
  let threads = initial;
  let ids = 0;
  return {
    loadThreads: async () => threads,
    addComment: async (_: string, c: { anchor?: { quote: string; line: number }; text: string }) =>
      (threads = comment(threads, { ...c, id: `t${++ids}`, at })),
    replyToThread: async (_: string, id: string, r: { text: string }) =>
      (threads = reply(threads, id, { author: 'calvin', text: r.text, at })!),
    resolveThread: async (_: string, id: string) => (threads = resolve(threads, id)!),
  };
}

const text = signal('---\ndraft: true\n---\nAlpha beta. @@ cut this?\nGamma delta.\n');

function setup(initial: Thread[] = []) {
  const state = createThreadState('a', text, fakeApi(initial));
  return state;
}

describe('thread state', () => {
  it('lists threads and notes in the order they appear', async () => {
    const s = setup();
    s.composing.value = { kind: 'comment', anchor: { quote: 'Gamma', line: 5 } };
    await s.send('why gamma?');
    expect(s.items.value.map((i) => [i.kind, i.messages[0].text])).toEqual([
      ['note', 'cut this?'],
      ['thread', 'why gamma?'],
    ]);
    expect(s.selected.value).toBe('t1');
    expect(s.composing.value).toBeUndefined();
  });

  it('moves between threads with J/K and stops at the ends', async () => {
    const s = setup();
    s.composing.value = { kind: 'comment', anchor: { quote: 'Gamma', line: 5 } };
    await s.send('x');
    s.selected.value = undefined;
    expect(s.move(1)?.kind).toBe('note');
    expect(s.move(1)?.id).toBe('t1');
    expect(s.move(1)?.id).toBe('t1');
    expect(s.move(-1)?.kind).toBe('note');
  });

  it('replies to and resolves the selected thread, but not a note', async () => {
    const s = setup();
    s.composing.value = { kind: 'comment', anchor: { quote: 'Gamma', line: 5 } };
    await s.send('x');
    s.replyToSelected();
    await s.send('y');
    expect(s.threads.value[0].messages).toHaveLength(2);
    await s.resolveSelected();
    expect(s.items.value.map((i) => i.kind)).toEqual(['note']);
    expect(s.tally.value).toEqual({ open: 1, resolved: 1 });

    s.selected.value = s.items.value[0].id;
    s.replyToSelected();
    expect(s.composing.value).toBeUndefined();
  });

  it('sends page comments to the page thread', async () => {
    const s = setup();
    s.composing.value = { kind: 'page' };
    await s.send('overall?');
    expect(s.page.value?.id).toBe(PAGE);
  });

  it('shows threads whose words are gone as lost', async () => {
    const s = setup([{ id: 'old', anchor: { quote: 'Epsilon', line: 4 }, resolved: false, messages: [] }]);
    await s.load();
    expect(s.lost.value.map((t) => t.id)).toEqual(['old']);
    expect(s.items.value.map((i) => i.kind)).toEqual(['note']);
  });

  it('keeps the composer open and shows why when sending fails', async () => {
    const s = createThreadState('a', text, {
      ...fakeApi(),
      addComment: async () => {
        throw new Error('disk full');
      },
    });
    s.composing.value = { kind: 'page' };
    expect(await s.send('x')).toBe(false);
    expect(s.error.value).toBe('disk full');
    expect(s.composing.value).toEqual({ kind: 'page' });
  });
});
