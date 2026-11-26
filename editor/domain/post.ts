import { splitFrontMatter, stats, type Stats } from './document.ts';

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
