import { splitFrontMatter, stats, type Stats } from './document.ts';
import { writeFrontMatter } from './front-matter.ts';

export type PostFile = { slug: string; text: string; modified: Date };
/** A post on the start page. `date` is the front matter's publish date, when it has one (eg 2021-08-01). */
export type PostSummary = { slug: string; title: string; draft: boolean; date?: string; modified: Date } & Stats;

/** Folder names under src/content/posts. Anything else is refused, so a slug can't reach outside it. */
export function isSlug(s: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/i.test(s);
}

export function isDraft(text: string): boolean {
  return /^draft:\s*true\s*$/m.test(splitFrontMatter(text).frontMatter);
}

export function title(text: string): string | undefined {
  const m = splitFrontMatter(text).frontMatter.match(/^title:[ \t]*(.*?)[ \t]*$/m);
  const t = m?.[1].replace(/^(['"])(.*)\1$/, '$2');
  return t || undefined;
}

export function publishDate(text: string): string | undefined {
  return splitFrontMatter(text).frontMatter.match(/^date:[ \t]*['"]?(\d{4}-\d{2}-\d{2})/m)?.[1];
}

/** Drafts first, most recently edited first, then published posts, newest first. */
export function postList(posts: PostFile[]): PostSummary[] {
  const summary = (p: PostFile): PostSummary => {
    const date = publishDate(p.text);
    return { slug: p.slug, title: title(p.text) ?? p.slug, draft: isDraft(p.text), ...(date && { date }), modified: p.modified, ...stats(p.text) };
  };
  const all = posts.map(summary);
  const drafts = all.filter((p) => p.draft).sort((a, b) => b.modified.getTime() - a.modified.getTime());
  const published = all.filter((p) => !p.draft).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.modified.getTime() - a.modified.getTime());
  return [...drafts, ...published];
}

/** A short snake_case slug from a title, as /scope makes them (eg "The Plugin Pattern" is plugin_pattern). */
export function slugFor(title: string): string {
  const words = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  // Leading articles add nothing to a URL.
  while (words.length > 1 && ['the', 'a', 'an'].includes(words[0])) words.shift();
  return words.join('_');
}

/** A new draft: front matter only, dated `today` (eg 2026-11-26). */
export function newDraft(title: string, today: string): string {
  return writeFrontMatter('', { title, draft: true, date: today, categories: [], summary: '', other: '' });
}

/** A date as front matter writes it, in local time (eg 2026-11-26). */
export function dayOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
