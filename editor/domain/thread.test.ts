import { describe, expect, it } from 'vitest';
import { comment, counts, notes, PAGE, reanchor, reply, resolve, type Thread } from './thread.ts';

const at = '2026-11-25T12:00:00.000Z';
const anchored = (): Thread[] => comment([], { id: 't1', anchor: { quote: 'two', line: 1 }, text: 'why?', at });

describe('threads', () => {
  it('starts a thread on quoted text', () => {
    expect(anchored()).toEqual([
      { id: 't1', anchor: { quote: 'two', line: 1 }, resolved: false, messages: [{ author: 'calvin', text: 'why?', at }] },
    ]);
  });

  it('collects comments without an anchor in the one page thread', () => {
    const once = comment([], { id: 'x', text: 'first', at });
    const twice = comment(once, { id: 'y', text: 'second', at });
    expect(twice).toHaveLength(1);
    expect(twice[0].id).toBe(PAGE);
    expect(twice[0].messages.map((m) => m.text)).toEqual(['first', 'second']);
  });

  it('reopens a resolved thread on reply', () => {
    const done = resolve(anchored(), 't1')!;
    expect(done[0].resolved).toBe(true);
    const again = reply(done, 't1', { author: 'claude', text: 'because', at })!;
    expect(again[0].resolved).toBe(false);
    expect(again[0].messages).toHaveLength(2);
  });

  it('is undefined for a thread that does not exist', () => {
    expect(reply([], 'nope', { author: 'calvin', text: '', at })).toBeUndefined();
    expect(resolve([], 'nope')).toBeUndefined();
  });

  it.each([
    ['moves the line hint with the words', 'zero\none two\n', { lost: undefined, line: 2 }],
    ['marks the thread lost when the words are gone', 'one three\n', { lost: true, line: 1 }],
  ])('%s', (_, text, want) => {
    const [t] = reanchor(anchored(), text);
    expect(t.lost).toBe(want.lost);
    expect(t.anchor!.line).toBe(want.line);
  });

  it('finds its place again when the words come back', () => {
    const lost = reanchor(anchored(), 'gone');
    expect(reanchor(lost, 'one two')[0]).not.toHaveProperty('lost');
  });

  it('counts open and resolved, with notes as open', () => {
    const two = comment(anchored(), { id: 't2', anchor: { quote: 'one', line: 1 }, text: 'hm', at });
    expect(counts(resolve(two, 't1')!, 3)).toEqual({ open: 4, resolved: 1 });
  });
});

describe('notes', () => {
  it('reads @@ notes as threads, with claude: notes as replies', () => {
    const text = '---\ntitle: T\n---\nA line. @@ too long? @@ More.\n@@ claude: agreed\n';
    expect(notes(text)).toEqual([
      { id: 'note:@@ too long? @@#1', anchor: { quote: '@@ too long? @@', line: 4 }, message: { author: 'calvin', text: 'too long?', at: '' } },
      { id: 'note:@@ claude: agreed#1', anchor: { quote: '@@ claude: agreed', line: 5 }, message: { author: 'claude', text: 'agreed', at: '' } },
    ]);
  });

  it('numbers repeats of the same note', () => {
    expect(notes('@@ x\n@@ x\n').map((n) => n.id)).toEqual(['note:@@ x#1', 'note:@@ x#2']);
  });
});
