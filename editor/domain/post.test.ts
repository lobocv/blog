import { describe, expect, it } from 'vitest';
import { dayOf, isDraft, isSlug, newDraft, postList, publishDate, slugFor, title, type PostFile } from './post.ts';

const post = (slug: string, draft: boolean, day: number, head = `title: ${slug}`): PostFile => ({
  slug,
  text: `---\n${head}\ndraft: ${draft}\n---\none two three`,
  modified: new Date(2026, 10, day),
});

describe('isDraft', () => {
  it.each([
    ['---\ndraft: true\n---\n', true],
    ['---\ndraft: false\n---\n', false],
    ['---\ntitle: x\n---\n', false],
    ['---\ntitle: x\n---\ndraft: true\n', false],
  ])('%j is %s', (text, want) => expect(isDraft(text)).toBe(want));
});

describe('isSlug', () => {
  it.each([
    ['plugin_pattern', true],
    ['db-model-2', true],
    ['', false],
    ['../etc', false],
    ['a/b', false],
    ['.hidden', false],
  ])('%j is %s', (s, want) => expect(isSlug(s)).toBe(want));
});

describe('title', () => {
  it.each([
    ['---\ntitle: "The Plugin Pattern"\n---\n', 'The Plugin Pattern'],
    ["---\ntitle: 'Single'\n---\n", 'Single'],
    ['---\ntitle: Plain words\n---\n', 'Plain words'],
    ['---\ntitle:\n---\n', undefined],
    ['no front matter', undefined],
  ])('%j', (text, want) => expect(title(text)).toBe(want));
});

describe('publishDate', () => {
  it.each([
    ['---\ndate: 2021-08-01\n---\n', '2021-08-01'],
    ['---\ndate: "2024-02-10T10:00:00Z"\n---\n', '2024-02-10'],
    ['---\ntitle: x\n---\n', undefined],
  ])('%j', (text, want) => expect(publishDate(text)).toBe(want));
});

describe('postList', () => {
  it('lists drafts by when they were edited, then published posts by date, with their stats', () => {
    const list = postList([
      post('old', true, 1),
      post('live2021', false, 9, 'title: live2021\ndate: 2021-08-01'),
      post('new', true, 5, 'title: "New one"'),
      post('live2024', false, 2, 'title: live2024\ndate: 2024-01-05'),
    ]);
    expect(list.map((p) => p.slug)).toEqual(['new', 'old', 'live2024', 'live2021']);
    expect(list[0]).toEqual({ slug: 'new', title: 'New one', draft: true, modified: new Date(2026, 10, 5), words: 3, minutes: 1 });
    expect(list[2]).toMatchObject({ draft: false, date: '2024-01-05' });
  });

  it('falls back to the slug without a title', () => {
    expect(postList([post('untitled', true, 1, 'summary: x')])[0].title).toBe('untitled');
  });
});

describe('slugFor', () => {
  it.each([
    ['The Plugin Pattern', 'plugin_pattern'],
    ['Reducing System Load With Event Folding!', 'reducing_system_load_with_event_folding'],
    ['  Naïve café: a story ', 'naive_cafe_a_story'],
    ['A', 'a'],
    ['?!', ''],
  ])('%j is %j', (t, want) => expect(slugFor(t)).toBe(want));
});

describe('newDraft', () => {
  it('is front matter only, a dated draft', () => {
    expect(newDraft('Hello "world"', '2026-11-26')).toBe('---\ntitle: "Hello \\"world\\""\ndraft: true\ndate: 2026-11-26\n---\n\n');
    expect(isDraft(newDraft('x', '2026-11-26'))).toBe(true);
  });

  it('dates it in local time', () => expect(dayOf(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05'));
});
