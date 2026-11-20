import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { unified, rehypeHeadingIds } from '@astrojs/markdown-remark';
import { rehypeCaptions, rehypeHeadingAnchors } from './src/lib/rehype.mjs';
import { shikiConfig } from './src/lib/shiki.mjs';
import { legacyRedirects } from './src/lib/redirects.mjs';

export default defineConfig({
  site: 'https://blog.lobocv.com',
  build: { format: 'directory' },
  integrations: [sitemap()],
  redirects: legacyRedirects('src/content/posts'),
  markdown: {
    processor: unified({ remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex, rehypeHeadingIds, rehypeHeadingAnchors, rehypeCaptions] }),
    shikiConfig,
  },
});
