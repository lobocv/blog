import { describe, expect, it } from 'vitest';
import { anchorAt, anchorNear, lineOf, locate } from './anchor.ts';

const text = 'one two\nthree two\nfour\n';

describe('lineOf', () => {
  it.each([
    [0, 1],
    [7, 1],
    [8, 2],
    [18, 3],
  ])('position %i is on line %i', (pos, line) => expect(lineOf(text, pos)).toBe(line));
});

describe('anchorAt', () => {
  it('quotes the selection', () => expect(anchorAt(text, { from: 8, to: 13 })).toEqual({ quote: 'three', line: 2 }));
  it('quotes the whole line for an empty selection', () =>
    expect(anchorAt(text, { from: 10, to: 10 })).toEqual({ quote: 'three two', line: 2 }));
  it('handles the last line without a newline', () => expect(anchorAt('a\nb', { from: 2, to: 2 })).toEqual({ quote: 'b', line: 2 }));
});

describe('locate', () => {
  it.each([
    ['the copy on the hinted line', { quote: 'two', line: 2 }, { from: 14, to: 17 }],
    ['the copy nearest the hint', { quote: 'two', line: 1 }, { from: 4, to: 7 }],
    ['the words after lines are added above', { quote: 'four', line: 1 }, { from: 18, to: 22 }],
  ])('finds %s', (_, anchor, want) => expect(locate(text, anchor)).toEqual(want));

  it('is undefined once the words are gone', () => expect(locate(text, { quote: 'five', line: 3 })).toBeUndefined());
  it('is undefined for a blank quote', () => expect(locate(text, { quote: '  ', line: 1 })).toBeUndefined());
});

describe('anchorNear', () => {
  const post = '---\ntitle: T\n---\n\nSome **bold** words here.\nAnd a second line.\n\nwords again\n';
  it.each([
    ['quotes plain selected words found near the block', 'words here', 5, { quote: 'words here', line: 5 }],
    ['picks the copy nearest the block', 'words', 8, { quote: 'words', line: 8 }],
    ['falls back to the block line when the words differ in the source', 'Some bold words', 5, { quote: 'Some **bold** words here.', line: 5 }],
    ['falls back for an empty selection', '', 5, { quote: 'Some **bold** words here.', line: 5 }],
    ['skips blank lines to the next text', '', 4, { quote: 'Some **bold** words here.', line: 5 }],
  ])('%s', (_, selected, line, want) => expect(anchorNear(post, selected, line)).toEqual(want));
});
