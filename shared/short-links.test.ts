import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, codeFrom, isCode, shortUrl, sitePath } from './short-links.ts';

describe('short links', () => {
  it('makes codes from random bytes, in the alphabet', () => {
    const code = codeFrom(new Uint8Array([0, 1, 30, 31, 255, 100, 9]));
    expect(code).toBe(`ab9a${CODE_ALPHABET[255 % 31]}${CODE_ALPHABET[100 % 31]}`);
    expect(isCode(code)).toBe(true);
  });

  it.each(['k3x9q2', 'abcdef'])('accepts %s', (c) => expect(isCode(c)).toBe(true));
  it.each(['k3x9q', 'k3x9q2x', 'K3X9Q2', 'k0x9q2', 'l1x9q2', '../a/b'])('refuses %s', (c) => expect(isCode(c)).toBe(false));

  it('builds the URL and takes a URL back to its path', () => {
    expect(shortUrl('k3x9q2')).toBe('https://www.lobocv.com/s/k3x9q2/');
    expect(sitePath('https://www.lobocv.com/posts/a/?utm_source=x&utm_medium=social')).toBe('/posts/a/?utm_source=x&utm_medium=social');
  });
});
