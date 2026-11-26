import { describe, expect, it } from 'vitest';
import { splitFrontMatter, stats } from './document.ts';

describe('splitFrontMatter', () => {
  it.each([
    ['with front matter', '---\ntitle: A\n---\nBody', '---\ntitle: A\n---\n', 'Body'],
    ['without front matter', 'Body only', '', 'Body only'],
    ['front matter and nothing else', '---\ndraft: true\n---', '---\ndraft: true\n---', ''],
    ['a rule later in the body', 'Intro\n---\nMore', '', 'Intro\n---\nMore'],
    ['Windows line endings', '---\r\na: 1\r\n---\r\nBody', '---\r\na: 1\r\n---\r\n', 'Body'],
  ])('%s', (_, text, frontMatter, body) => {
    expect(splitFrontMatter(text)).toEqual({ frontMatter, body });
  });
});

describe('stats', () => {
  it('counts the body only', () => {
    expect(stats('---\ntitle: Many words in this title\n---\none two three')).toEqual({ words: 3, minutes: 1 });
  });

  it('rounds reading time up at 213 words a minute', () => {
    expect(stats('word '.repeat(213)).minutes).toBe(1);
    expect(stats('word '.repeat(214)).minutes).toBe(2);
  });
});
