// Where the site is deployed. astro.config.mjs reads it too, so there is one copy.
import { postPath } from './preview.ts';

export const SITE = 'https://www.lobocv.com';

/** A post's address on the deployed site, eg https://www.lobocv.com/posts/some_post/ */
export const postUrl = (slug: string, origin = SITE) => `${origin}${postPath(slug)}`;

/** The post's social preview image, as src/pages/og/ builds it. */
export const previewImageUrl = (slug: string, origin = SITE) => `${origin}/og/${encodeURIComponent(slug)}.png`;
