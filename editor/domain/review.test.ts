import { describe, expect, it } from 'vitest';
import { setReview } from './review.ts';
import { comment, PAGE } from './thread.ts';

describe('setReview', () => {
  it('starts the page thread with the progress', () => {
    expect(setReview([], { title: ' Line critique ', done: 0, total: 7 })).toEqual({
      threads: [{ id: PAGE, resolved: false, messages: [], review: { title: 'Line critique', done: 0, total: 7 } }],
    });
  });

  it('updates the progress on an existing page thread', () => {
    const page = comment([], { id: 'x', text: 'hi', at: '' });
    const result = setReview(page, { title: 'Line critique', done: 3, total: 7 });
    expect('threads' in result && result.threads[0]).toMatchObject({ messages: [{ text: 'hi' }], review: { done: 3 } });
  });

  it.each([
    [{ title: '', done: 0, total: 1 }],
    [{ title: 'x', done: 2, total: 1 }],
    [{ title: 'x', done: 0, total: 0 }],
    [{ title: 'x', done: 1.5, total: 3 }],
  ])('refuses %j', (review) => expect('error' in setReview([], review)).toBe(true));
});
