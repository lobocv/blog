import { describe, expect, it } from 'vitest';
import { formatDate, readingMinutes, categorySlug, categoryCounts, neighbours, pickTocHeadings, sortPosts } from './posts';

const post = (id: string, categories: string[] = [], date?: string) =>
  ({ id, data: { title: id, draft: false, categories, date: date ? new Date(date) : undefined } }) as any;

describe('formatDate', () => {
  it('formats in UTC so western time zones do not show the previous day', () => {
    expect(formatDate(new Date('2022-10-01'))).toBe('Oct 1, 2022');
  });
});

describe('readingMinutes', () => {
  it('rounds up at 213 words per minute', () => {
    expect(readingMinutes('word '.repeat(426))).toBe(2);
    expect(readingMinutes('word '.repeat(427))).toBe(3);
  });
  it('counts words in code like Hugo, but not punctuation-only tokens', () => {
    expect(readingMinutes('```go\n' + 'x '.repeat(426) + '\n```')).toBe(2);
    expect(readingMinutes('word '.repeat(213) + '{ } ( ) := '.repeat(100))).toBe(1);
  });
  it('excludes HTML tags but keeps their text', () => {
    expect(readingMinutes('<div style="text-align:center">' + 'w '.repeat(214) + '</div>')).toBe(2);
  });
});

describe('categorySlug', () => {
  it('lowercases and hyphenates like Hugo', () => {
    expect(categorySlug('Developer Efficiency')).toBe('developer-efficiency');
  });
});

describe('categoryCounts', () => {
  it('sorts by count, then name', () => {
    const posts = [post('a', ['Golang']), post('b', ['Golang']), post('c', ['Databases']), post('d', ['Architecture'])];
    expect(categoryCounts(posts)).toEqual([['Golang', 2], ['Architecture', 1], ['Databases', 1]]);
  });
});

describe('sortPosts', () => {
  it('orders newest first and treats a missing date as today', () => {
    const sorted = sortPosts([post('old', [], '2020-01-01'), post('draft'), post('mid', [], '2022-01-01')]);
    expect(sorted.map(p => p.id)).toEqual(['draft', 'mid', 'old']);
  });
});

describe('neighbours', () => {
  const posts = [post('a'), post('b'), post('c')];
  it('returns the next older and next newer post', () => {
    const n = neighbours(posts, 'b');
    expect(n.older?.id).toBe('c');
    expect(n.newer?.id).toBe('a');
  });
  it('has no newer post for the newest', () => {
    expect(neighbours(posts, 'a').newer).toBeUndefined();
    expect(neighbours(posts, 'c').older).toBeUndefined();
  });
});

describe('pickTocHeadings', () => {
  const h = (...depths: number[]) => depths.map((depth, i) => ({ depth, slug: 's' + i, text: 't' + i }));
  it('uses the highest level with at least two headings', () => {
    expect(pickTocHeadings(h(3, 3, 3)).map(x => x.slug)).toEqual(['s0', 's1', 's2']);
    expect(pickTocHeadings(h(2, 3, 3)).map(x => x.slug)).toEqual(['s1', 's2']);
    expect(pickTocHeadings(h(2, 2, 3)).map(x => x.slug)).toEqual(['s0', 's1']);
  });
  it('ignores the generated footnotes heading', () => {
    const hs = [{ depth: 2, slug: 'a', text: 'A' }, { depth: 2, slug: 'footnote-label', text: 'Footnotes' }, { depth: 3, slug: 'b', text: 'B' }, { depth: 3, slug: 'c', text: 'C' }];
    expect(pickTocHeadings(hs).map(x => x.slug)).toEqual(['b', 'c']);
  });
  it('returns nothing when no level has two headings', () => {
    expect(pickTocHeadings(h(2))).toEqual([]);
    expect(pickTocHeadings(h(1, 1))).toEqual([]);
  });
});
