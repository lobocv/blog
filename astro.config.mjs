import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { unified } from '@astrojs/markdown-remark';
import { shikiConfig } from './src/lib/shiki.mjs';
import fs from 'node:fs';

// Hugo's category pages and taxonomy lists now redirect to the filtered posts index.
// Categories are read from post front matter (`categories: ["A", "B"]`) so new ones get a redirect too.
function legacyRedirects() {
  const names = new Set();
  for (const dir of fs.readdirSync('src/content/posts')) {
    const md = fs.readFileSync(`src/content/posts/${dir}/index.md`, 'utf8');
    const line = md.match(/^categories:\s*\[(.*)\]/m);
    if (line) for (const m of line[1].matchAll(/"([^"]+)"/g)) names.add(m[1]);
  }
  const out = { '/categories': '/posts/', '/tags': '/posts/' };
  for (const n of names) out[`/categories/${n.toLowerCase().replace(/\s+/g, '-')}`] = `/posts/?cat=${n}`; // Astro URL-encodes the target itself
  return out;
}

export default defineConfig({
  site: 'https://blog.lobocv.com',
  build: { format: 'directory' },
  integrations: [sitemap()],
  redirects: legacyRedirects(),
  markdown: {
    processor: unified({ remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] }),
    shikiConfig,
  },
});
