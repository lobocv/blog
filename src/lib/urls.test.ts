import { describe, expect, it } from 'vitest';
import { oldUrlMissing } from './urls';

describe('oldUrlMissing', () => {
  const files = new Set(['index.html', 'posts/index.html', 'index.xml', 'posts/a/img.png']);
  it('treats a trailing slash as index.html', () => {
    expect(oldUrlMissing('/posts/', files)).toBe(false);
    expect(oldUrlMissing('/about/', files)).toBe(true);
  });
  it('checks files directly', () => {
    expect(oldUrlMissing('/index.xml', files)).toBe(false);
    expect(oldUrlMissing('/posts/a/img.png', files)).toBe(false);
    expect(oldUrlMissing('/posts/a/other.png', files)).toBe(true);
  });
});
