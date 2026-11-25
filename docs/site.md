# The site's code

How the Astro site is built. Read this before changing anything under `src/`
(other than post and project content), `astro.config.mjs` or `scripts/`.
Commands are in `AGENTS.md`.

Static Astro site deployed to GitHub Pages (www.lobocv.com). The old
`blog.lobocv.com` is served by the `lobocv/blog-redirect` repo, which sends every
path to the same path here. Pushing to `master` runs
`.github/workflows/gh-pages.yml`, which gates the deploy on the same checks as
`make verify`.

## Content

- Posts are `src/content/posts/<slug>/index.md` (or `.mdx`); the folder name is
  the slug and URL (`/posts/<slug>/`). The schema in `src/content.config.ts`
  requires `date` and `summary` unless `draft: true`, and allows an optional
  `feature: {lang, code}` snippet shown on the home page card
- Post images live in `public/posts/<slug>/` (absolute paths) or next to the post
  (relative `![alt](x.svg)`)
- `getPosts()` in `src/lib/posts.ts` is the single source of the post list:
  newest first, drafts dropped in production. `src/lib/redirects.mjs` reads
  frontmatter separately (at config time) and also skips drafts
- Home page copy under the hero (philosophy, about) is in `src/data/home.ts`
- Interactive figures for posts are Astro components in `src/components/post/`,
  built on the shared pieces in `src/components/figure/` (see `docs/figures.md`)

## Markdown pipeline

Configured in `astro.config.mjs` via `unified()` from `@astrojs/markdown-remark`;
`@astrojs/mdx` picks up the same plugins:

- `remark-math` + `rehype-katex` for maths
- `rehypeNotes` (`src/lib/notes.mjs`) shows `@@` drafting notes in `astro dev`,
  drops them from drafts in a build, and fails the build if a published post
  still has one
- `rehypeHeadingIds` then `rehypeHeadingAnchors` (adds the hover `#` links; must
  run after ids exist)
- `rehypeCaptions` turns the bold `Figure N:` / `Table N:` caption convention into
  `<figure>`/`<figcaption>`, wraps tables for horizontal scroll, and makes a
  `**Table: name**` line the table `<caption>`. Raw `<img>` tags in Markdown
  arrive as `raw` nodes, which the plugin handles
- Shiki uses a custom theme whose colours are CSS variables (`--tok-*`), so code
  follows day/night without re-rendering. Transformers: trim leading blank lines,
  `title="..."` fence meta, line highlighting (`{1,3-4}` or
  `// [!code highlight]`). The same theme renders the home page feature card
- GFM footnotes (`[^1]`) are on by default; `pickTocHeadings` filters out the
  generated `footnote-label` heading

Astro caches rendered Markdown in `node_modules/.astro`. After changing the
pipeline (`astro.config.mjs`, `src/lib/rehype.mjs`, `src/lib/notes.mjs`,
`src/lib/shiki.mjs`), a plain `npm run build` serves stale post HTML. `make build`
clears the cache first.

## Theming and art

- Day/night is `data-time` on `<html>`, set before first paint by an inline
  script in `src/layouts/Base.astro` (`?time=` override, then `localStorage`,
  then local hour). All colours are tokens in `src/styles/site.css` (`:root` is
  night, `[data-time="day"]` overrides). `src/lib/og.ts` parses the `:root` block
  to colour social images, so keep tokens there
- `src/scripts/art/landscape.js` draws the procedural SVG art (horizon band,
  foliage, side vines, topo lines) from seeded RNGs. Changing the order of
  `rng()` calls changes the art everywhere
- `src/scripts/hero/hero.js` is the home hero: a port of
  `prototypes/mockups/home.html` that pre-bakes layers to canvas bitmaps and only
  animates transforms/opacity for performance. `prototypes/mockups/` is the
  approved design source
- Side foliage is drawn on every page by `Base.astro` (and by the home page for
  its sheet), redrawn when page height changes

## Client behaviour

Small TypeScript modules in `src/scripts/`, imported by page `<script>` tags:
`post.ts` (code block header/copy/scroll fade, footnote hover popovers on mouse
devices, image lightbox, TOC highlight, reading progress), `filter.ts`
(`/posts/?cat=` category filter), `theme.ts` (toggle).

## Compatibility with the old Hugo site

These exist so old links and feed subscribers keep working; don't remove them
without a reason:

- `tests/old-urls.txt` lists Hugo-era URLs that must exist in `dist/`
  (`make check-urls`)
- `/categories/<slug>` redirects to `/posts/?cat=<Name>` (generated in
  `src/lib/redirects.mjs`; pass the raw category name, Astro encodes it)
- RSS (`/index.xml`, `/posts/index.xml`) is hand-written in `src/lib/feed.ts` to
  keep Hugo's `http://` guids. `@astrojs/rss` can't do that, so don't switch to it
- Social preview images are built per post at `/og/<slug>.png` by
  `src/pages/og/[slug].png.ts` (satori + resvg, fonts from `@fontsource`)

## Verifying visual changes

Check rendered pages at desktop and phone widths, in both day and night
(`?time=day`). Animations can't be judged from screenshots;
`prototypes/tools/record-toggle.mjs` records frames.
