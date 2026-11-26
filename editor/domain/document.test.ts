import { describe, expect, it } from 'vitest';
import { sections, splitFrontMatter, stats } from './document.ts';

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

describe('sections', () => {
  it('lists headings with their line in the file, front matter included', () => {
    const text = '---\ntitle: A\n---\nIntro.\n\n## Why\n\nText.\n\n### Detail ##\n';
    expect(sections(text)).toEqual([
      { level: 2, title: 'Why', line: 6 },
      { level: 3, title: 'Detail', line: 10 },
    ]);
  });

  it('skips headings inside code blocks, and lines that only look like headings', () => {
    const text = '# Top\n```sh\n# a comment\n````\n#hashtag\n~~~\n## Not this\n~~~\n## After\n';
    expect(sections(text).map((s) => s.title)).toEqual(['Top', 'After']);
  });

  it('works without front matter', () => {
    expect(sections('## One\n')).toEqual([{ level: 2, title: 'One', line: 1 }]);
  });
});
