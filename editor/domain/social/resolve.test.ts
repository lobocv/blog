import { describe, expect, it } from 'vitest';
import type { Network } from './network.ts';
import { resolvePost } from './resolve.ts';
import { emptyPost } from './social-post.ts';

const net = {
  utmSource: 'n',
  hashtags: { min: 1, max: 2, placement: 'end' },
  media: ['link-card', 'text-only'],
  defaultMedia: 'link-card',
  assemble: (p) => ({ text: [p.text, p.link, ...p.hashtags].join('|'), shift: 0 }),
} as Network;
const ctx = { postUrl: 'https://www.lobocv.com/posts/a/', categories: ['AI', 'Architecture'] };

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
});
