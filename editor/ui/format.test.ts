import { describe, expect, it } from 'vitest';
import { formatAgo } from './format.ts';

describe('formatAgo', () => {
  const now = new Date('2026-11-25T12:00:00Z');
  const ago = (seconds: number) => formatAgo(new Date(now.getTime() - seconds * 1000), now);

  it.each([
    [10, 'just now'],
    [120, '2 minutes ago'],
    [3 * 3600, '3 hours ago'],
    [86400, 'yesterday'],
    [6 * 86400, '6 days ago'],
    [15 * 86400, '2 weeks ago'],
    [400 * 86400, 'last year'],
  ])('%i seconds ago is %j', (seconds, want) => expect(ago(seconds)).toBe(want));
});
