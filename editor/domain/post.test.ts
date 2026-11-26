import { describe, expect, it } from 'vitest';
import { drafts, isDraft, isSlug, title, type PostFile } from './post.ts';

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

describe('drafts', () => {
  it('lists drafts only, most recently edited first, with their stats', () => {
    const list = drafts([post('old', true, 1), post('live', false, 9), post('new', true, 5, 'title: "New one"')]);
    expect(list).toEqual([
      { slug: 'new', title: 'New one', modified: new Date(2026, 10, 5), words: 3, minutes: 1 },
      { slug: 'old', title: 'old', modified: new Date(2026, 10, 1), words: 3, minutes: 1 },
    ]);
  });

  it('falls back to the slug without a title', () => {
    expect(drafts([post('untitled', true, 1, 'summary: x')])[0].title).toBe('untitled');
  });
});
