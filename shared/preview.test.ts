import { describe, expect, it } from 'vitest';
import { blockAt, postPath } from './preview.ts';

const el = (line: number) => ({ getAttribute: () => String(line), line }) as unknown as Element & { line: number };

describe('blockAt', () => {
  const blocks = [el(6), el(8), el(12), el(9)];
  it.each([
    [6, 6],
    [7, 6],
    [10, 9],
    [40, 12],
  ])('line %i is in the block starting on %i', (line, want) => expect((blockAt(blocks, line) as any).line).toBe(want));
  it('is undefined above the first block', () => expect(blockAt(blocks, 2)).toBeUndefined());
  it('picks the inner block when two start on the same line (eg an image in its paragraph)', () => {
    const [p, img] = [el(6), el(6)];
    expect(blockAt([p, img], 6)).toBe(img);
  });
});

it('builds the post URL', () => expect(postPath('plugin_pattern')).toBe('/posts/plugin_pattern/'));
