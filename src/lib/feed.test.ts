import { describe, expect, it } from 'vitest';
import { buildFeed } from './feed';

const post = (id: string, title: string, date: string, summary: string) => ({ id, data: { title, date: new Date(date), summary, categories: [], draft: false } }) as any;

describe('buildFeed', () => {
  const xml = buildFeed([post('golang_testing', 'Testing & Go', '2022-10-01', 'A <b>summary</b>')], 'https://blog.lobocv.com');
  it('keeps the guid Hugo used, so readers do not re-show old posts', () => {
    expect(xml).toContain('<guid isPermaLink="false">http://blog.lobocv.com/posts/golang_testing/</guid>');
  });
  it('links to the https post URL with a trailing slash', () => {
    expect(xml).toContain('<link>https://blog.lobocv.com/posts/golang_testing/</link>');
  });
  it('escapes text', () => {
    expect(xml).toContain('<title>Testing &amp; Go</title>');
    expect(xml).toContain('<description>A &lt;b&gt;summary&lt;/b&gt;</description>');
  });
  it('uses RFC 822 dates', () => {
    expect(xml).toContain('<pubDate>Sat, 01 Oct 2022 00:00:00 GMT</pubDate>');
  });
});
