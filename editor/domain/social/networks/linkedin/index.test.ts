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

  it('suggests portrait only for figures clearly taller than wide', () => {
    expect(linkedin.defaultShape({ width: 1200, height: 630 })).toBe('landscape');
    expect(linkedin.defaultShape({ width: 680, height: 700 })).toBe('landscape');
    expect(linkedin.defaultShape({ width: 680, height: 900 })).toBe('portrait');
    for (const s of linkedin.imageShapes) expect(s.width / s.height).toBeLessThanOrEqual(3);
    for (const s of linkedin.imageShapes) expect(s.width / s.height).toBeGreaterThanOrEqual(4 / 5);
  });
});
