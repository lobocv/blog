import { describe, expect, it } from 'vitest';
import { longestFitting } from './fold.ts';

describe('longestFitting', () => {
  it.each([
    [100, 100, 100],
    [100, 37, 37],
    [100, 0, 0],
    [1, 0, 0],
    [0, 0, 0],
  ])('length %i, fits up to %i: %i', (length, limit, want) => {
    const asked: number[] = [];
    expect(longestFitting(length, (k) => (asked.push(k), k <= limit))).toBe(want);
    // A binary search, not a scan: a phone preview re-renders for every question.
    expect(asked.length).toBeLessThanOrEqual(Math.ceil(Math.log2(length + 1)) + 2);
  });
});
