// Hugo's category pages and taxonomy lists, redirected to the filtered posts index.
// Used by astro.config.mjs; categories come from published posts' front matter, so new ones get a redirect too.
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from '@astrojs/markdown-remark';

export function legacyRedirects(postsDir) {
  const names = new Set();
  for (const slug of fs.readdirSync(postsDir)) {
    const file = path.join(postsDir, slug, 'index.md');
    if (!fs.existsSync(file)) continue;
    const { frontmatter } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    if (frontmatter.draft === true) continue;
    for (const c of frontmatter.categories ?? []) names.add(String(c));
  }
  const out = { '/categories': '/posts/', '/tags': '/posts/' };
  // Astro URL-encodes redirect targets itself, so the name goes in raw.
  for (const n of names) out[`/categories/${n.toLowerCase().replace(/\s+/g, '-')}`] = `/posts/?cat=${n}`;
  return out;
}
