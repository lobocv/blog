import { describe, expect, it } from 'vitest';
import { openMechanical, openSuggestion, settle, suggest, target } from './suggestion.ts';
import { comment, type Thread } from './thread.ts';

const at = '2026-11-25T12:00:00.000Z';
const text = '---\ndraft: true\n---\nIt was incredible amounts of work.\n\nincredible again\n';
const threads = (): Thread[] => comment([], { id: 't1', anchor: { quote: 'incredible amounts', line: 4 }, text: 'too much?', at });
const base = { threadId: 't1', id: 's1', find: 'incredible amounts of', replace: 'a lot of', reason: 'Plainer.', at };

describe('suggest', () => {
  it('adds the suggestion to the thread as a message from Claude', () => {
    const result = suggest(threads(), text, base);
    expect('threads' in result && result.threads[0].messages.at(-1)).toEqual({
      author: 'claude',
      text: 'Plainer.',
      at,
      suggestion: { id: 's1', find: 'incredible amounts of', replace: 'a lot of', line: 4, status: 'open' },
    });
  });

  it('gives a suggestion from the page thread its own thread on the words it changes', () => {
    const page = comment([], { id: 'x', text: '/critique line', at });
    const result = suggest(page, text, { ...base, threadId: 'page' });
    expect('threads' in result && result.threads[1]).toMatchObject({
      id: 's1-thread',
      anchor: { quote: 'incredible amounts of', line: 4 },
      messages: [{ author: 'claude', text: 'Plainer.', suggestion: { id: 's1' } }],
    });
    expect('threads' in result && result.threads[0].messages).toHaveLength(1);
  });

  it('uses the copy of the words nearest the thread', () => {
    const result = suggest(threads(), text, { ...base, find: 'incredible' });
    expect('threads' in result && result.threads[0].messages.at(-1)?.suggestion?.line).toBe(4);
  });

  it.each([
    ['a missing thread', { threadId: 'nope' }, /no thread/],
    ['words not in the post', { find: 'amazing' }, /not in the post/],
    ['an empty find', { find: '' }, /empty/],
    ['no change', { replace: 'incredible amounts of' }, /same/],
  ])('explains %s', (_, change, error) => {
    const result = suggest(threads(), text, { ...base, ...change });
    expect('error' in result && result.error).toMatch(error);
  });
});

describe('settling', () => {
  const withSuggestion = () => (suggest(threads(), text, base) as { threads: Thread[] }).threads;

  it('finds the open suggestion, then none once accepted with a tweak', () => {
    const list = withSuggestion();
    expect(openSuggestion(list[0])?.id).toBe('s1');
    const done = settle(list, 's1', 'accepted', 'lots of')!;
    expect(done[0].messages.at(-1)?.suggestion).toMatchObject({ status: 'accepted', replace: 'lots of' });
    expect(openSuggestion(done[0])).toBeUndefined();
  });

  it.each([
    ['inside the quote', 'incredible amounts', 'incredible amounts of', 'a lot of', 'a lot of'],
    ['containing the quote', 'It was incredible amounts of work.', 'incredible amounts of', 'a lot of', 'It was a lot of work.'],
    ['beside the quote', 'work', 'incredible amounts of', 'a lot of', 'work'],
  ])('moves the quote with an accepted edit %s', (_, quote, find, replace, want) => {
    const list = comment([], { id: 't1', anchor: { quote, line: 4 }, text: 'x', at });
    const withS = (suggest(list, text, { ...base, find, replace }) as { threads: Thread[] }).threads;
    const lostToo = withS.map((t) => ({ ...t, lost: true }));
    const [t] = settle(lostToo, 's1', 'accepted')!;
    expect(t.anchor?.quote).toBe(want);
    expect(t.lost).toBeUndefined();
  });

  it('leaves the quote alone when the edit is rejected', () => {
    const [t] = settle(withSuggestion(), 's1', 'rejected')!;
    expect(t.anchor?.quote).toBe('incredible amounts');
  });

  it('is undefined for a suggestion that does not exist', () => expect(settle(withSuggestion(), 'nope', 'rejected')).toBeUndefined());

  it('finds where the suggestion applies, until the words change', () => {
    expect(target(text, { find: 'incredible amounts of', line: 4 })).toEqual({ from: 27, to: 48 });
    expect(target('It was work.', { find: 'incredible amounts of', line: 4 })).toBeUndefined();
  });
});

describe('mechanical fixes', () => {
  it('marks a suggestion mechanical, and lists the open ones', () => {
    const list = (suggest(threads(), text, { ...base, mechanical: true }) as { threads: Thread[] }).threads;
    expect(openMechanical(list).map((s) => s.id)).toEqual(['s1']);
    expect(openMechanical(settle(list, 's1', 'accepted')!)).toEqual([]);
  });
});
