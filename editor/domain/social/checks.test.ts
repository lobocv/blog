import { describe, expect, it } from 'vitest';
import { checkPost, hookEnd } from './checks.ts';
import type { Network } from './network.ts';

// A plain network, so these tests don't depend on any real one's numbers.
const net: Network = {
  id: 'test',
  label: 'Test',
  composeUrl: 'https://example.com/compose',
  count: (t) => t.length,
  limit: 40,
  fold: { kind: 'lines', lines: 2, viewport: 'phone' },
  assemble: ({ text, link, hashtags }) => ({ text: [text.trim(), link, hashtags.map((t) => `#${t}`).join(' ')].filter(Boolean).join('\n'), shift: -(text.length - text.trimStart().length) }),
  hashtags: { min: 1, max: 2, placement: 'end' },
  media: ['link-card'],
  defaultMedia: 'link-card',
  imageShapes: [],
  defaultShape: () => 'landscape',
  altText: true,
  guide: '',
  defaultLink: 'tagged',
  utmSource: 'test',
};
const parts = (text: string, hashtags = ['A']) => ({ text, link: '', hashtags });
const names = (text: string, h?: string[], fold?: { text: string; offset: number }) => checkPost(net, parts(text, h), fold).map((f) => f.check);

describe('hookEnd', () => {
  it.each([
    ['', 0],
    ['One paragraph.', 14],
    ['One paragraph.\n', 14],
    ['Hook.\n\nMore.', 5],
    ['\n\n  Hook.\n\nMore.', 9],
    ['Hook.\r\n\r\nMore.', 5],
    ['Line one\nline two\n\nMore.', 17],
    ['Hook.\n  \nMore.', 5],
  ])('%j ends at %i', (text, end) => expect(hookEnd(text)).toBe(end));
});

describe('checkPost', () => {
  it('passes a clean post', () => expect(names('Short and plain.')).toEqual([]));

  it('counts the assembled text, link and hashtags included', () => {
    const text = 'x'.repeat(30);
    expect(names(text, ['A'])).toEqual([]);
    expect(checkPost(net, { text, link: 'https://example.com/a', hashtags: ['A'] }).map((f) => f.check)).toEqual(['length']);
  });

  it('flags a hook that runs past the fold, from the fold to the end of the hook', () => {
    const text = 'A long hook here.\n\nMore.';
    const assembled = net.assemble(parts(text)).text;
    const [f] = checkPost(net, parts(text), { text: assembled, offset: 7 });
    expect(f.check).toBe('fold');
    expect(f.ranges).toEqual([{ from: 7, to: 17 }]);
  });

  it('passes a hook that ends exactly at the fold', () => {
    const text = 'Hook.\n\nMore.';
    expect(names(text, undefined, { text: net.assemble(parts(text)).text, offset: 5 })).toEqual([]);
  });

  it('maps the fold through trimmed leading space', () => {
    const text = '\n\nA long hook.';
    const [f] = checkPost(net, parts(text), { text: net.assemble(parts(text)).text, offset: 2 });
    expect(f.ranges).toEqual([{ from: 4, to: 14 }]);
  });

  it('ignores a fold measured for other text, rather than guessing', () => {
    expect(names('A long hook here.', undefined, { text: 'older text', offset: 2 })).toEqual([]);
  });

  it('counts hashtag chips and hashtags in the text', () => {
    expect(names('Plain.', [])).toEqual(['hashtags']);
    expect(names('About #Go, #AI and #DB.', [])).toEqual(['hashtags']);
    expect(names('About #Go.', ['A'])).toEqual([]);
    expect(names('Issue#3 is not a tag.', ['A'])).toEqual([]);
  });

  it('highlights banned words and em-dashes in his text', () => {
    const f = checkPost(net, parts('We leverage it — twice.'));
    expect(f.map((x) => [x.check, x.ranges])).toEqual([
      ['banned', [{ from: 3, to: 11 }]],
      ['em-dash', [{ from: 15, to: 16 }]],
    ]);
  });

  it('asks for alt text on an image, when the network takes it', () => {
    expect(checkPost(net, parts('Fine.'), undefined, { alt: ' ' }).map((f) => f.check)).toEqual(['alt']);
    expect(checkPost(net, parts('Fine.'), undefined, { alt: 'A tree of topics.' })).toEqual([]);
    expect(checkPost({ ...net, altText: false }, parts('Fine.'), undefined, { alt: '' })).toEqual([]);
  });

  it("runs the network's own checks after the shared ones", () => {
    const own: Network = { ...net, checks: [() => [{ check: 'own', message: 'no', ranges: [] }]] };
    expect(checkPost(own, parts('Fine.')).map((f) => f.check)).toEqual(['own']);
  });
});
