import { describe, expect, it } from 'vitest';
import { initialCategory } from './filter';

describe('initialCategory', () => {
  it('decodes a category with spaces', () => {
    expect(initialCategory('?cat=Developer%20Efficiency', ['Golang', 'Developer Efficiency'])).toBe('Developer Efficiency');
  });
  it('falls back to All for an unknown category', () => {
    expect(initialCategory('?cat=Nope', ['Golang'])).toBe('All');
  });
  it('is All with no query', () => {
    expect(initialCategory('', ['Golang'])).toBe('All');
  });
});
