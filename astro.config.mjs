import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import fs from 'node:fs';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { unified, rehypeHeadingIds } from '@astrojs/markdown-remark';
import { rehypeCaptions, rehypeHeadingAnchors } from './src/lib/rehype.mjs';
import { shikiConfig } from './src/lib/shiki.mjs';
import { legacyRedirects } from './src/lib/redirects.mjs';

// /projects/ stays out of the sitemap until a project is published
const publishedProjects = fs.existsSync('src/content/projects')
  ? fs.readdirSync('src/content/projects').filter(d => {
      const f = `src/content/projects/${d}/index.mdx`;
      return fs.existsSync(f) && !/^draft:\s*true\s*$/m.test(fs.readFileSync(f, 'utf8').split('---')[1] ?? '');
    })
  : [];

export default defineConfig({
  site: 'https://www.lobocv.com',
  build: { format: 'directory' },
  integrations: [mdx(), sitemap({ filter: page => publishedProjects.length > 0 || !page.includes('/projects/') })],
  // /about/ was folded into the journey page
  redirects: { ...legacyRedirects('src/content/posts'), '/about': '/journey/' },
  markdown: {
    processor: unified({ remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex, rehypeHeadingIds, rehypeHeadingAnchors, rehypeCaptions] }),
    shikiConfig,
  },
});
