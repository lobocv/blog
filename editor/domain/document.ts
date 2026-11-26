import { countWords, readingMinutes } from '../../shared/reading.ts';

export type Stats = { words: number; minutes: number };

/** Splits a post into its front matter block (with the --- fences) and body. */
export function splitFrontMatter(text: string): { frontMatter: string; body: string } {
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/);
  return m ? { frontMatter: m[0], body: text.slice(m[0].length) } : { frontMatter: '', body: text };
}

/** Words and reading time, counted the same way as the site's post pages. */
export function stats(text: string): Stats {
  const { body } = splitFrontMatter(text);
  return { words: countWords(body), minutes: readingMinutes(body) };
}
