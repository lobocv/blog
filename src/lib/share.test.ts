import { describe, expect, it } from 'vitest';
import { shareLinks, taggedUrl } from './share';

const url = 'https://www.lobocv.com/posts/some_post/';

describe('taggedUrl', () => {
  it('tags the network as the source and share as the medium', () => {
    expect(taggedUrl(url, 'linkedin')).toBe(`${url}?utm_source=linkedin&utm_medium=share`);
  });
});

describe('shareLinks', () => {
  const links = shareLinks(url, 'Some Post & More', '@calvinlobo');
  const byNetwork = Object.fromEntries(links.map(l => [l.network, new URL(l.href)]));

  it('gives LinkedIn the tagged post URL', () => {
    expect(byNetwork.linkedin.searchParams.get('url')).toBe(taggedUrl(url, 'linkedin'));
  });

  it('gives X the title, the tagged URL and the handle without the @', () => {
    const x = byNetwork.x.searchParams;
    expect(x.get('text')).toBe('Some Post & More');
    expect(x.get('url')).toBe(taggedUrl(url, 'x'));
    expect(x.get('via')).toBe('calvinlobo');
  });

  it('puts the title and tagged URL in the Bluesky post text', () => {
    expect(byNetwork.bluesky.searchParams.get('text')).toBe(`Some Post & More ${taggedUrl(url, 'bluesky')}`);
  });
});
