import { expect, it } from 'vitest';
import { taggedUrl } from './links.ts';

it('tags the post URL for social posts', () => {
  expect(taggedUrl('https://www.lobocv.com/posts/a/', 'net')).toBe('https://www.lobocv.com/posts/a/?utm_source=net&utm_medium=social');
});
