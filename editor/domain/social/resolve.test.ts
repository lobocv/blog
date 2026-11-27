import { describe, expect, it } from 'vitest';
import type { Network } from './network.ts';
import { imageKey, resolvePost } from './resolve.ts';
import { emptyPost } from './social-post.ts';

const net = {
  utmSource: 'n',
  hashtags: { min: 1, max: 2, placement: 'end' },
  media: ['link-card', 'text-only', 'image'],
  defaultMedia: 'link-card',
  imageShapes: [{ id: 'wide', label: 'Wide', width: 2, height: 1 }],
  assemble: (p) => ({ text: [p.text, p.link, ...p.hashtags].join('|'), shift: 0 }),
} as Network;
const ctx = { postUrl: 'https://www.lobocv.com/posts/a/', categories: ['AI', 'Architecture'], title: 'Title', summary: 'What it says.' };

describe('resolvePost', () => {
  it('fills in the tagged link, hashtags from the categories and the default media', () => {
    const r = resolvePost(net, { ...emptyPost(), text: 'Hi' }, ctx);
    expect(r.parts).toEqual({ text: 'Hi', link: 'https://www.lobocv.com/posts/a/?utm_source=n&utm_medium=social', hashtags: ['AI', 'SoftwareArchitecture'] });
    expect(r.media).toBe('link-card');
    expect(r.assembled.text).toBe(`Hi|${r.parts.link}|AI|SoftwareArchitecture`);
  });

  it("keeps Calvin's choices, and drops a media choice the network no longer offers", () => {
    expect(resolvePost(net, { ...emptyPost(), hashtags: [], media: { kind: 'text-only' } }, ctx)).toMatchObject({ parts: { hashtags: [] }, media: 'text-only' });
    expect(resolvePost({ ...net, media: ['link-card'] }, { ...emptyPost(), media: { kind: 'text-only' } }, ctx).media).toBe('link-card');
  });

  it('has no image unless the media is an image', () => {
    expect(resolvePost(net, emptyPost(), ctx).image).toBeUndefined();
  });

  it('defaults an image to the preview card, day, with the title and summary as alt text', () => {
    const r = resolvePost({ ...net, defaultMedia: 'image' }, emptyPost(), ctx);
    expect(r.image).toEqual({ figure: { kind: 'preview' }, theme: 'day', alt: 'Title. What it says.' });
  });

  it("keeps Calvin's image choices, and drops a shape the network doesn't have", () => {
    const figure = { kind: 'component' as const, source: 'src/components/post/Tree.astro' };
    const r = resolvePost(net, { ...emptyPost(), media: { kind: 'image', figure, theme: 'night', shape: 'wide' } }, ctx);
    expect(r.image).toEqual({ figure, theme: 'night', shape: 'wide', alt: '' });
    expect(resolvePost(net, { ...emptyPost(), media: { kind: 'image', shape: 'tall' } }, ctx).image?.shape).toBeUndefined();
  });

  it('keys an image by what it is rendered from, not its alt text', () => {
    const a = { figure: { kind: 'preview' as const }, theme: 'day' as const, alt: 'one' };
    expect(imageKey(a)).toBe(imageKey({ ...a, alt: 'two' }));
    expect(imageKey(a)).not.toBe(imageKey({ ...a, theme: 'night' }));
    expect(imageKey(a)).not.toBe(imageKey({ ...a, shape: 'wide' }));
  });
});
