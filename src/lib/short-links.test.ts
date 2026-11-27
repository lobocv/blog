import { describe, expect, it } from 'vitest';
import { shortLinkPages } from './short-links';

const posts = [{ id: 'a', title: 'A post', summary: 'What it says.' }];

describe('shortLinkPages', () => {
  it('makes a page per code with its post', () => {
    expect(shortLinkPages({ k3x9q2: { post: 'a', to: '/posts/a/?utm_source=bluesky&utm_medium=social' } }, posts)).toEqual([
      { code: 'k3x9q2', to: '/posts/a/?utm_source=bluesky&utm_medium=social', post: posts[0] },
    ]);
  });

  it.each([
    [{ 'k3x9q!': { post: 'a', to: '/posts/a/' } }, "isn't a short link code"],
    [{ k3x9q2: { post: 'a', to: 'https://evil.example/' } }, "isn't a path on the site"],
    [{ k3x9q2: { post: 'a', to: '//evil.example/' } }, "isn't a path on the site"],
    [{ k3x9q2: { post: 'gone', to: '/posts/gone/' } }, "isn't a published post"],
  ])('fails the build on %j', (links, why) => {
    expect(() => shortLinkPages(links, posts)).toThrow(why);
  });
});
