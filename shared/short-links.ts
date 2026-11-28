// First-party short links (https://www.lobocv.com/s/<code>/), kept in src/data/short-links.json.
// The blog builds a page per code that redirects to `to`; the share page in the editor adds codes.
// See docs/decisions/2026-11-27-first-party-short-links.md.
import { SITE } from './site.ts';

/** Where a code goes: `to` is a path on the site with its query (eg /posts/x/?utm_source=bluesky&utm_medium=social), for `post`. */
export type ShortLink = { post: string; to: string };

/** Letters and digits that can't be mistaken for each other (no 0/o, 1/l/i), so a code survives being read aloud or retyped. */
export const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const CODE_LENGTH = 6;

export const isCode = (code: string) => new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(code);

/** A code from random bytes (one per character). */
export const codeFrom = (bytes: Uint8Array) => [...bytes.slice(0, CODE_LENGTH)].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');

export const shortPath = (code: string) => `/s/${code}/`;
export const shortUrl = (code: string, origin = SITE) => `${origin}${shortPath(code)}`;

/** The site path and query of a URL on the site, as a short link's `to`. */
export const sitePath = (url: string) => {
  const u = new URL(url);
  return `${u.pathname}${u.search}`;
};
