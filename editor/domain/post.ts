import { splitFrontMatter, stats, type Stats } from './document.ts';

export type PostFile = { slug: string; text: string; modified: Date };
export type DraftSummary = { slug: string; title: string; modified: Date } & Stats;

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

/** The drafts, most recently edited first. */
export function drafts(posts: PostFile[]): DraftSummary[] {
  return posts
    .filter((p) => isDraft(p.text))
    .sort((a, b) => b.modified.getTime() - a.modified.getTime())
    .map((p) => ({ slug: p.slug, title: title(p.text) ?? p.slug, modified: p.modified, ...stats(p.text) }));
}
