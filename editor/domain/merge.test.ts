import { describe, expect, it } from 'vitest';
import { change, lineChange, merge } from './merge.ts';

describe('change', () => {
  it.each([
    ['abcdef', 'abXYef', { from: 2, toA: 4, toB: 4 }],
    ['abc', 'abc', { from: 3, toA: 3, toB: 3 }],
    ['abc', 'abcd', { from: 3, toA: 3, toB: 4 }],
    ['aaa', 'aa', { from: 2, toA: 3, toB: 2 }],
  ])('%j to %j', (a, b, want) => expect(change(a, b)).toEqual(want));
});

describe('lineChange', () => {
  it('covers whole lines', () => expect(lineChange('a\nTwo.\n\nThree.\n', 'a\nThree.\n')).toEqual({ from: 2, toA: 8, toB: 2 }));
});

describe('merge', () => {
  const base = 'One.\n\nTwo.\n\nThree.\n';
  it.each([
    ['takes theirs when Calvin typed nothing', base, 'One!\n\nTwo.\n\nThree.\n', 'One!\n\nTwo.\n\nThree.\n'],
    ['keeps mine when they changed nothing', 'One.\n\nTwo!\n\nThree.\n', base, 'One.\n\nTwo!\n\nThree.\n'],
    ['merges edits in different paragraphs', 'One.\n\nTwo.\n\nThree, typed.\n', 'One, outside.\n\nTwo.\n\nThree.\n', 'One, outside.\n\nTwo.\n\nThree, typed.\n'],
    ['merges in either order', 'One, typed.\n\nTwo.\n\nThree.\n', 'One.\n\nTwo.\n\nThree, outside.\n', 'One, typed.\n\nTwo.\n\nThree, outside.\n'],
    ['merges an outside deletion', 'One.\n\nTwo.\n\nThree, typed.\n', 'One.\n\nThree.\n', 'One.\n\nThree, typed.\n'],
    ['agrees when both made the same edit', 'One!\n\nTwo.\n\nThree.\n', 'One!\n\nTwo.\n\nThree.\n', 'One!\n\nTwo.\n\nThree.\n'],
  ])('%s', (_, mine, theirs, want) => expect(merge(base, mine, theirs)).toBe(want));

  it('gives up when both changed the same line, even in different words', () => {
    expect(merge('Two. Typed.\n', 'Two. Typed. More.\n', 'Two, from Zed.\n')).toBeUndefined();
  });

  it('merges edits on neighbouring lines', () => {
    expect(merge('a\nb\n', 'a!\nb\n', 'a\nb?\n')).toBe('a!\nb?\n');
  });

  it('gives up when both changed the same words', () => {
    expect(merge(base, 'One.\n\nTwo, typed.\n\nThree.\n', 'One.\n\nTwo, outside.\n\nThree.\n')).toBeUndefined();
  });
});
