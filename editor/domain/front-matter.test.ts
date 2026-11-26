import { describe, expect, it } from 'vitest';
import { type FrontMatter, problems, readFrontMatter, writeFrontMatter } from './front-matter.ts';

const blank: FrontMatter = { title: '', draft: false, date: '', categories: [], summary: '', other: '' };

describe('readFrontMatter', () => {
  it('reads the fields the posts schema has, however they are quoted', () => {
    const text = `---\ntitle: "The \\"Plugin\\" Pattern"\ndraft: true\ndate: 2021-08-01\ncategories: ["AI", 'Go lang', Plain]\nsummary: It's plain\n---\nBody\n`;
    expect(readFrontMatter(text)).toEqual({
      title: 'The "Plugin" Pattern',
      draft: true,
      date: '2021-08-01',
      categories: ['AI', 'Go lang', 'Plain'],
      summary: "It's plain",
      other: '',
    });
  });

  it('keeps other keys as YAML, with their indented lines', () => {
    const text = '---\ntitle: T\nfeature:\n  lang: go\n  code: |\n    x := 1\ncategories:\n  - Go\n  - DB\n---\nBody';
    expect(readFrontMatter(text)).toMatchObject({ categories: ['Go', 'DB'], other: 'feature:\n  lang: go\n  code: |\n    x := 1' });
  });

  it('reads front matter with nothing after it', () => {
    expect(readFrontMatter('---\ntitle: T\ndraft: true\n---')).toMatchObject({ title: 'T', draft: true });
  });

  it('gives empty fields when the post has no front matter', () => expect(readFrontMatter('Just words.\n')).toEqual(blank));
  it('a rule in a post without front matter is not front matter', () => expect(readFrontMatter('Intro.\n\n---\n\nMore.\n')).toEqual(blank));

  it.each([
    ['a typo before the first ---', 'hh---\ntitle: "T"\ndraft: true\n---\nBody'],
    ['no closing ---', '---\ntitle: T\nBody'],
    ['a draft that is not true or false', '---\ntitle: T\ndraft: yes please\n---\n'],
    ['a title over several lines', '---\ntitle: >\n  Long\n---\n'],
  ])("can't read %s", (_, text) => expect(readFrontMatter(text)).toBeUndefined());
});

describe('writeFrontMatter', () => {
  it('writes the fields in one order and format, keeping the body and other keys', () => {
    const text = "---\nsummary: 'old'\ntitle: Old\nfeature:\n  lang: go\n---\n\nBody\n";
    const fm = { ...readFrontMatter(text)!, title: 'New "one"', categories: ['A', 'B'], date: '2026-11-26' };
    expect(writeFrontMatter(text, fm)).toBe(
      '---\ntitle: "New \\"one\\""\ndraft: false\ndate: 2026-11-26\ncategories: ["A", "B"]\nsummary: "old"\nfeature:\n  lang: go\n---\n\nBody\n',
    );
  });

  it('adds front matter to a post without any', () => {
    expect(writeFrontMatter('Body\n', { ...blank, title: 'T', draft: true })).toBe('---\ntitle: "T"\ndraft: true\n---\n\nBody\n');
  });

  it('reads back what it wrote', () => {
    const fm = { title: 'A: b, "c"', draft: true, date: '2021-08-01', categories: ['x, y', "it's"], summary: 'S #1', other: '' };
    expect(readFrontMatter(writeFrontMatter('Body', fm))).toEqual(fm);
  });
});

describe('problems', () => {
  it('needs a title, and a date and summary to publish, as the site does', () => {
    expect(problems({ ...blank, draft: true, title: 'T' })).toEqual({});
    expect(problems({ ...blank })).toEqual({ title: 'Required', date: 'Needed to publish', summary: 'Needed to publish' });
    expect(problems({ ...blank, title: 'T', draft: true, date: 'soon' })).toEqual({ date: 'Not a date' });
  });
});
