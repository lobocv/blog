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

/** A heading in the post: its level (1 for `#`), its text, and the line it's on (front matter included). */
export type Section = { level: number; title: string; line: number };

/** The post's Markdown headings in order, skipping front matter and code blocks. */
export function sections(text: string): Section[] {
  const { frontMatter, body } = splitFrontMatter(text);
  const first = frontMatter ? frontMatter.split('\n').length - (frontMatter.endsWith('\n') ? 1 : 0) : 0;
  const out: Section[] = [];
  let fence: string | undefined;
  body.split(/\r?\n/).forEach((line, i) => {
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f) {
      if (!fence) fence = f[1];
      else if (f[1][0] === fence[0] && f[1].length >= fence.length) fence = undefined;
      return;
    }
    const h = !fence && line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) out.push({ level: h[1].length, title: h[2], line: first + i + 1 });
  });
  return out;
}
