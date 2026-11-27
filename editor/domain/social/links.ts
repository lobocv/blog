// The link each network's post carries.

/** The post's URL tagged for a network's analytics, eg ...?utm_source=<source>&utm_medium=social */
export function taggedUrl(postUrl: string, utmSource: string): string {
  const u = new URL(postUrl);
  u.searchParams.set('utm_source', utmSource);
  // utm_medium=share is for readers' shares from the buttons on the post, so the two stay apart.
  u.searchParams.set('utm_medium', 'social');
  return u.toString();
}

// Where the post lives on the deployed site, for the layers that can't import shared/ directly.
export { postUrl, previewImageUrl } from '../../../shared/site.ts';
export { codeFrom, shortPath, shortUrl, sitePath, type ShortLink } from '../../../shared/short-links.ts';
