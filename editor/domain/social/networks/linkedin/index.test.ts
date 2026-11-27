import { describe, expect, it } from 'vitest';
import { linkedin } from './index.ts';

const link = 'https://www.lobocv.com/posts/a/?utm_source=linkedin&utm_medium=social';

describe('linkedin', () => {
  it('puts the text, then the link, then the hashtags', () => {
    expect(linkedin.assemble({ text: '  Hook.\n\nMore.\n', link, hashtags: ['AI', 'Go'] })).toEqual({
      text: `Hook.\n\nMore.\n\n${link}\n\n#AI #Go`,
      shift: -2,
    });
  });

  it("doesn't repeat a link Calvin placed in the text", () => {
    expect(linkedin.assemble({ text: `Read it: ${link}`, link, hashtags: [] }).text).toBe(`Read it: ${link}`);
  });

  it('leaves out empty parts', () => {
    expect(linkedin.assemble({ text: '', link: '', hashtags: [] }).text).toBe('');
  });

  it('counts an emoji once', () => {
    expect(linkedin.count('Hi 👋🏽')).toBe(4);
  });

  it('offers only media it supports, with its default among them', () => {
    expect(linkedin.media).toContain(linkedin.defaultMedia);
  });
});
