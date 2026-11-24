import type { CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;
export type Heading = { depth: number; slug: string; text: string };

const time = (p: Post) => (p.data.date ?? new Date()).getTime();

/** Newest first; a missing date (drafts) sorts as today. */
export function sortPosts(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => time(b) - time(a));
}

/** Published posts in production, all posts in dev, newest first. */
export async function getPosts(): Promise<Post[]> {
  // Imported lazily so the pure helpers below can be unit tested outside Astro.
  const { getCollection } = await import('astro:content');
  const posts = await getCollection('posts', p => !(import.meta.env.PROD && p.data.draft));
  return sortPosts(posts);
}

export function readingMinutes(markdown: string): number {
  // Like Hugo, code counts as reading; fence markers, tags and punctuation-only tokens don't.
  // MDX import lines and {/* comments */} aren't reading either.
  const text = markdown.replace(/^```.*$/gm, ' ').replace(/^import .*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/<[^>]+>/g, ' ');
  const words = text.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
  return Math.max(1, Math.ceil(words / 213));
}

const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export const formatDate = (d: Date): string => fmt.format(d);

export const categorySlug = (name: string): string => name.toLowerCase().replace(/\s+/g, '-');

export function categoryCounts(posts: Post[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const p of posts) for (const c of p.data.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** `posts` must be newest first. */
export function neighbours(posts: Post[], id: string): { older?: Post; newer?: Post } {
  const i = posts.findIndex(p => p.id === id);
  return { older: posts[i + 1], newer: i > 0 ? posts[i - 1] : undefined };
}

/** The highest heading level (h2 and below) that has at least two headings. */
export function pickTocHeadings<T extends Heading>(headings: T[]): T[] {
  // footnote-label is the "Footnotes" heading Markdown footnotes generate
  const real = headings.filter(h => h.slug !== 'footnote-label');
  for (let depth = 2; depth <= 6; depth++) {
    const at = real.filter(h => h.depth === depth);
    if (at.length >= 2) return at;
  }
  return [];
}
