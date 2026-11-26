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
import { rehypeNotes } from './src/lib/notes.mjs';
import { rehypeSourceLines } from './src/lib/source-lines.mjs';

// `astro dev` shows drafting notes (@@ ...) on the page; a build drops or rejects them
const dev = process.argv.includes('dev');
// The writing editor's preview (see docs/editor/architecture.md): pages carry source lines and a
// script that talks to the editor. Astro's content cache notices the different config and
// re-renders, so pages cached by a plain `make dev` don't show up untagged.
const editorPreview = dev && process.env.EDITOR_PREVIEW === '1';
const editorBridge = {
  name: 'editor-bridge',
  hooks: {
    'astro:config:setup': ({ injectScript }) =>
      injectScript('page', "import { startBridge } from '/shared/preview.ts'; startBridge(window);"),
  },
};

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
  integrations: [...(editorPreview ? [editorBridge] : []), mdx(), sitemap({ filter: page => publishedProjects.length > 0 || !page.includes('/projects/') })],
  devToolbar: { enabled: !editorPreview },
  // /about/ was folded into the journey page
  redirects: { ...legacyRedirects('src/content/posts'), '/about': '/journey/' },
  markdown: {
    processor: unified({ remarkPlugins: [remarkMath], rehypePlugins: [...(editorPreview ? [rehypeSourceLines] : []), [rehypeNotes, { dev }], rehypeKatex, rehypeHeadingIds, rehypeHeadingAnchors, rehypeCaptions] }),
    shikiConfig,
  },
});
