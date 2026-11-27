import { describe, expect, it } from 'vitest';
import { clearPosted, edit, emptyPost, keepVersion, markCopied, markPosted, restore, type SocialPost, withNetworks } from './social-post.ts';

const v = (text: string, hashtags: string[] = [], at = '2026-11-27T10:00:00.000Z') => ({ text, hashtags, author: 'calvin' as const, at });
const post = (p: Partial<SocialPost> = {}): SocialPost => ({ ...emptyPost(), ...p });

describe('withNetworks', () => {
  it('adds missing networks and keeps ones no longer enabled', () => {
    const state = { schemaVersion: 1, networks: { old: post({ text: 'kept' }) } };
    expect(withNetworks(state, ['a', 'old']).networks).toEqual({ old: post({ text: 'kept' }), a: emptyPost() });
  });
});

describe('edit', () => {
  it('sends a ready post back to draft when something changes', () => {
    expect(edit(post({ status: 'ready', text: 'a' }), { text: 'b' }).status).toBe('draft');
    expect(edit(post({ status: 'ready', text: 'a' }), { text: 'a' }).status).toBe('ready');
    expect(edit(post({ status: 'ready' }), { media: { kind: 'text-only' } }).status).toBe('draft');
  });

  it('counts a changed image choice as a change', () => {
    const ready = post({ status: 'ready', media: { kind: 'image', theme: 'day' } });
    expect(edit(ready, { media: { kind: 'image', theme: 'night' } }).status).toBe('draft');
    expect(edit(ready, { media: { kind: 'image', theme: 'day' } }).status).toBe('ready');
  });

  it('leaves a posted post posted', () => {
    expect(edit(post({ status: 'posted' }), { text: 'b' }).status).toBe('posted');
  });

  it('stores hashtags only once Calvin changes them', () => {
    expect(edit(post(), { text: 'a' }).hashtags).toBeUndefined();
    expect(edit(post(), { hashtags: [] }).hashtags).toEqual([]);
  });
});

describe('versions', () => {
  it('keeps a version unless it matches the latest', () => {
    const one = keepVersion(post(), v('a'));
    expect(keepVersion(one, v('a', [], 'later')).versions).toHaveLength(1);
    expect(keepVersion(one, v('a', ['T'])).versions).toHaveLength(2);
    expect(keepVersion(keepVersion(one, v('b')), v('a')).versions.map((x) => x.text)).toEqual(['a', 'b', 'a']);
  });

  it('marks a copied post ready, with what was copied as a version', () => {
    const copied = markCopied(post({ text: 'old' }), v('new', ['T']));
    expect(copied).toMatchObject({ text: 'new', hashtags: ['T'], status: 'ready', versions: [v('new', ['T'])] });
    expect(markCopied(post({ status: 'posted' }), v('x')).status).toBe('posted');
  });

  it('keeps the text on screen before restoring an older version', () => {
    const p = post({ text: 'saved', versions: [v('first', ['A'])] });
    const r = restore(p, 0, v('on screen'));
    expect(r.text).toBe('first');
    expect(r.hashtags).toEqual(['A']);
    expect(r.versions.map((x) => x.text)).toEqual(['first', 'on screen']);
    expect(restore(p, 5, v('x'))).toBe(p);
  });
});

describe('posting', () => {
  it('records what went out, and can be cleared', () => {
    const p = markPosted(post({ text: 't' }), { url: 'https://example.com/p/1', at: 'now', text: 'as posted' });
    expect(p).toMatchObject({ status: 'posted', posted: { url: 'https://example.com/p/1', text: 'as posted' } });
    const c = clearPosted(p);
    expect(c.status).toBe('ready');
    expect('posted' in c).toBe(false);
  });
});
