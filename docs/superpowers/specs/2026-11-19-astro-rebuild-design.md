# Rebuild blog.lobocv.com in Astro

## Intent

The blog runs on Hugo with the `hugo-future-imperfect-slim` theme. We redesigned it as static HTML mockups in `prototypes/mockups/` (branch `hero-prototype`), and those mockups are approved. This project rebuilds the site in Astro so the mockups become the real site, with real posts behind them.

The mockups are the design. The Hugo theme goes away entirely. Where this doc and a mockup disagree on how something looks, the mockup wins. Where they disagree on content or behaviour, this doc wins.

## Goals

- The home page, posts index and post page look and behave like `home.html`, `posts.html` and `post.html`, driven by the real posts.
- Every published post URL keeps working (`/posts/<slug>/`), and so does the RSS feed URL.
- Deploys to GitHub Pages at `blog.lobocv.com` on push to `master`, as today.
- The wolf hero performs as it does in the mockup (canvas-baked layers, smooth day/night toggle).

## Non-goals

- Projects pages. They are deferred, and the "Projects" nav link and "See projects" button are removed until they exist.
- Share buttons, site search and email signup. All three are dropped, and can be added back later if needed.
- Category archive pages (Hugo's `/categories/<name>/`). Filtering happens on the posts index instead.
- Comments.
- Pre-rendering hero layers to images at build time. See Approaches.

## Anti-goals

- The hero must not regress to flickering or janky scrolling. The canvas-bake structure from the mockup is load-bearing, so port it, don't rewrite it.
- No visible drift from the mockups' look (eg a different code theme, fonts or spacing) because a library did it differently by default.
- No broken links from search engines or old shares.

## Constraints

- Static output only (GitHub Pages).
- The custom domain `blog.lobocv.com` keeps working. With an Actions-based Pages deploy the domain comes from the repo's Pages settings and GitHub ignores a `CNAME` file in the artifact, so keeping `CNAME` in `public/` is harmless but not what makes the domain work.
- Google Analytics ID `G-6GL7S6YEB3` stays.
- Day/night theming works the way the mockups do it: `data-time="day|night"` on `<html>`, chosen from a `?time=` override, else the saved choice in `localStorage` (`time`), else local hour (day from 07:00 to 19:00). This is the order in `site.js`. Colours come from CSS variables in `site.css`. The theme must be set before first paint, so there's no flash of the wrong theme.

## Approaches

These are the three ways we considered getting the wolf hero onto the page.

1. **Port the hero script as is.** The scene code from `home.html` runs in the browser and draws each layer into canvases on load, then re-draws them on resize.
   - Pro: it is the verified-smooth version and the lowest-risk port.
   - Pro: it stays sharp at any size.
   - Con: a roughly 0.6s fade-in on load while the canvases are drawn.
   - Con: slow phones do the drawing themselves.
2. **Pre-render the layers to images at build time.** Headless Chrome in CI would export each layer as WebP (day and night, several widths), and the page would only move images.
   - Pro: the fastest first paint.
   - Con: a heavy build that needs Playwright in CI.
   - Con: 20 to 40 image files to manage.
   - Con: softness between the exported widths.
   - Con: a second rewrite of a hero we only just stabilised.
3. **Ship option 1, and move to option 2 later only if real devices show the load-time drawing is a problem.**

Chosen: option 3. The scene is already split into layers and sprites, so moving to build-time images later would not change the page structure.

## Decisions

### Project layout

- Astro replaces Hugo in the same repo. Work happens on a new branch off `hero-prototype` and merges to `master` when ready.
- Hugo files are removed:
  - `config.toml`
  - `themes/` (a git submodule; it is the only entry in `.gitmodules`, so delete that file too)
  - `archetypes/`
  - the Docker dev wrapper (`Dockerfile`, `run.sh`, `build_image.sh`). Local dev becomes `npm run dev`, with no Docker replacement.
- `prototypes/` stays as reference until the Astro site matches it. Deleting it is a separate decision.
- `prototypes/blog2/` is untracked and out of scope. Its `content/` is identical to the repo's `content/`, so the content move starts from `content/`.
- Styling is plain CSS, ported from `site.css` and the per-page `<style>` blocks. No Tailwind.

### Content

- Posts move to `src/content/posts/<slug>/index.md` and load through an Astro content collection (eg a `glob` loader with pattern `*/index.md`). The entry id must equal the folder name, since it becomes the URL slug. Image files do not stay next to the Markdown (see below).
- Front matter keeps `title`, `date`, `categories` and `draft`, and gains two fields:
  - `summary` (required for published posts): the one-line description shown on cards, the post lede and RSS. The six published posts take the summaries written in `site.js` `POSTS`.
  - `feature` (optional): a short code excerpt with a language (eg `feature: { lang: go, code: "..." }`), shown on the home page's feature card when that post is the newest. `golang_testing` takes the snippet in `home.html`. The mockup's snippet is hand-coloured with `<span>` classes; the real one is highlighted with the same Shiki setup as post code blocks and tuned to look the same. When a newest post has no `feature`, the card renders without the code panel.
- `date` and `summary` are required only when `draft` is false. The two drafts have neither, so the schema must allow that, and sorting in dev must not choke on a missing date (eg treat it as today).
- Reading time is computed at build time from the rendered text's word count, at Hugo's 213 words per minute, rounded up, so the numbers stay close to the live site and the mockup.
- Dates are formatted in UTC (eg "Oct 1, 2022"). Front matter dates parse as UTC midnight, so formatting in local time shows the previous day for anyone west of UTC.
- `draft: true` posts (`db_model_signatures`, `plugin_pattern`) are excluded from production builds but shown in `astro dev`. Astro does not do this itself; filter on `import.meta.env.PROD` wherever the collection is read (pages, RSS, sitemap, home lists).
- `content/about/index.md` becomes the About page. It is not a post, so it stays out of the posts collection. `content/_index.md` is dropped.

### Post images and raw HTML

- Posts reference images by absolute URL, eg `https://blog.lobocv.com/posts/elasticsearch_slots/img.png`, often inside raw `<img>` and `<div>` HTML.
- Image files move to `public/posts/<slug>/`, so they are served at the same URLs as today.
- The `src` attributes are rewritten to root-relative paths (`/posts/<slug>/img.png`) so they also work in local dev.
- Raw HTML in Markdown must keep rendering (Hugo had `unsafe = true`).
- The `event_folding` post loads MathJax 2 from a CDN in an inline `<script>` and uses `$...$` math. Replace that with `remark-math` and `rehype-katex` at build time, delete the inline `<style>`, MathJax config and script, and load KaTeX's CSS on posts that use math. Check that every formula still renders.
  - Most of its formulas sit inside raw HTML (`<p style="text-align: center;">$...$</p>`). `remark-math` does not look inside raw HTML, so those stay as literal `$` text. Rewrite each as a Markdown display block (`$$ ... $$`), which KaTeX centres.
  - `remark-math` runs on every post. No other post has a `$` outside code today, but a future post with a bare `$` in prose would need it escaped (`\$`).

### Pages and URLs

| Path | Page | Source mockup |
|---|---|---|
| `/` | Home, with the wolf hero, latest writing, topics and author | `home.html` |
| `/posts/` | Posts index, grouped by year, with category filter chips | `posts.html` |
| `/posts/<slug>/` | Post | `post.html` |
| `/about/` | About | none (see below) |
| `/index.xml` | RSS feed of all published posts | n/a |
| `/404.html` | Not found | none (see below) |

- The About page has no mockup. Build it from the post page's pieces: slim horizon header, the post typography, and the author block. No TOC, no pager.
- The 404 page uses the slim horizon header, a short message and a link to `/posts/`.

Hugo also publishes other URLs. They are handled as follows:

- `/categories/<slug>/` becomes a static redirect page (meta refresh plus a canonical link, eg via Astro's `redirects` config) to `/posts/?cat=<Name>`, one per category in use. Hugo's `<slug>` is the lowercased, hyphenated name (eg `/categories/developer-efficiency/`); `<Name>` is the category exactly as written in front matter, URL-encoded (eg `?cat=Developer%20Efficiency`).
- `/categories/` (Hugo's category list, linked from its nav) redirects to `/posts/`.
- `/posts/index.xml` serves a second copy of the RSS feed.
- These are dropped and return 404:
  - paging (`/page/N/`, `/posts/page/N/`)
  - `/index.json` (it only fed the search we're dropping)
  - per-category feeds (`/categories/<slug>/index.xml`)
- To build the "old URL exists" check, take the list of URLs from the live `https://blog.lobocv.com/sitemap.xml`, minus the dropped ones above. Save that list into the repo before cutover, since the live file changes once the Astro site deploys.
- The RSS feed is served at `/index.xml`, Hugo's home feed path, so existing subscribers keep working. Use `@astrojs/rss` (eg an endpoint at `src/pages/index.xml.js`). Items carry the title, date, summary and link.
  - Item links must be the full URL with trailing slash (eg `https://blog.lobocv.com/posts/golang_testing/`). `@astrojs/rss` uses the link as the item's `<guid>`, and Hugo did the same, so matching them stops feed readers from showing every post as new. Compare against the live feed's `<guid>` values.
- Add a sitemap (`@astrojs/sitemap`). It writes `sitemap-index.xml` and `sitemap-0.xml`, not `sitemap.xml`, so also serve `/sitemap.xml` (eg a small endpoint with the same URLs) to replace Hugo's and keep any search console setup working.
- The `site` setting is `https://blog.lobocv.com`, with no base path. Keep the default `build.format: 'directory'` so pages are written as `<path>/index.html` and served with a trailing slash, like Hugo.

### Wiring nav and footer links

- Nav:
  - "lobocv" goes to `/`
  - "Writing" goes to `/posts/`
  - "About" goes to `/about/`
  - "Projects" is removed
- Home hero buttons:
  - "Read the blog" goes to `/posts/`
  - "See projects" is removed
- GitHub goes to `https://github.com/lobocv`, and LinkedIn goes to `https://www.linkedin.com/in/lobocv/` (both handles are from `config.toml` `[social]`). This covers the footer and the home author block.
- The home author block's "About me →" goes to `/about/`.
- RSS links go to `/index.xml`.
- Home "Latest writing":
  - the feature card is the newest post, and "Read the article →" goes to it
  - the rows under it are the next four posts, newest first (as `POSTS.slice(1, 5)` in the mockup)
  - "All posts →" goes to `/posts/`
- On the home page, topic chips (sorted by post count, most first) link to `/posts/?cat=<Name>`, and the posts index selects that chip on load. The posts index chips are "All" followed by the same count order.
- The post pager has two links:
  - "Previous" is the next-older post.
  - "Next" is the next-newer post.
  - At either end, the missing link becomes "Back to all writing" (`/posts/`), as in the mockup.

### Dropped from the mockups

- Every email signup block (the `.subscribe` sections on home, posts and post). Each block also holds an RSS line ("Prefer a feed reader? Subscribe via RSS" on home and posts, "Or follow along via RSS" on post). Keep that line as a small RSS link in the same spot.

### Hero

- The scene code in `home.html` becomes a module, eg `src/scripts/hero/`. It covers:
  - `buildScene`
  - `DAY_PALETTE`
  - layers and sprites
  - `bake`
  - the `ResizeObserver` re-bake
  - the theme crossfade
  - the sun/moon click
  - film grain
- The home page loads it with a bundled `<script>`.
- Port it with behaviour unchanged. Splitting it into a few files is fine. Changing the drawing, seeds or `rng()` call order is not, because the scene is seeded and any change to the call order changes the art.
- `site.js` splits into:
  - an inline theme bootstrap in `<head>` (sets `data-time` before paint). It must be `<script is:inline>`. Astro turns a plain `<script>` into a deferred module, which runs after first paint and brings back the flash.
  - the theme toggle
  - the horizon header (posts and post pages)
  - the foliage band, side foliage and topo lines (home)
  - the shared flora helpers the hero uses (`Site.flora`)
- The `POSTS` array in `site.js` goes away. Lists, cards, topics and counts are rendered at build time from the content collection.
- Keep `prototypes/tools/record-toggle.mjs` working against `astro preview`. It is how we check the toggle for flicker. It clicks `#toggle`, so keep that id on the toggle button.

### Post page

- Markdown renders at build time. The mockup's `marked` and `highlight.js` client libraries go away.
- Code highlighting uses Astro's built-in Shiki with two themes (light for day, dark for night), switched by `data-time` through CSS variables (eg `shikiConfig.themes` with `defaultColor: false`, then pick `--shiki-light` or `--shiki-dark` under `:root[data-time]`), and colours tuned to match the mockup's code panels.
- Fence languages in use are `go`, `bash`, `json`, `dockerfile` and `postgresql`. Shiki has no `postgresql` grammar, so map it to `sql` (eg `shikiConfig.langAlias`); otherwise those blocks render unhighlighted.
- The language label and Copy button on each code block stay. The label is rendered at build time (Astro puts the fence language in `data-language` on the `<pre>`), and the copy needs a small client script. The mockup labels unmarked fences as `go`; the real site shows no label for them instead (only the `db_model_signatures` draft has any).
- The table of contents is built at build time from the post's headings, using Astro's heading slugs as ids. Current-section highlighting and the reading progress bar stay as a small client script.
  - The mockup uses `h2` only, but `event_folding` has no `h2` (only `h3`) and `recursive_jsonb_merge` has one. Use the post's highest heading level that has at least two headings (eg `h3` for `event_folding`), and hide the TOC when there is nothing to list.

### Analytics and fonts

- Google Analytics uses the standard `gtag.js` snippet in the shared layout, loaded with `async`.
- Fonts (Fraunces, Inter, Inter Tight and JetBrains Mono at the weights in the mockups) are self-hosted via Fontsource rather than the Google Fonts `<link>`. This avoids a third-party request.
- The mockups load Fraunces with its optical size axis (`opsz` 9 to 144). Fontsource's default Fraunces import only carries weight, so use the variable package's file that includes `opsz`, or headings will drift from the mockups.

### Deploy

- Replace `.github/workflows/gh-pages.yml` with an Astro build (Node LTS, `npm ci`, `astro build`, upload `dist/`) using the current `actions/upload-pages-artifact` and `actions/deploy-pages` versions. Keep the trigger on push to `master` and manual dispatch. Drop the Hugo and Dart Sass install steps and `submodules: recursive` on checkout.
- Everything in `static/` moves to `public/`: `CNAME`, `favicon.ico` and `img/logo.jpg` (the author photo the mockups use).

## Left to the builder

- Astro version, component breakdown and file names under `src/`.
- Whether shared bits (nav, footer, horizon, author block) are Astro components or partial scripts.
- Exact Shiki themes, as long as day and night both match the mockups' code panels closely.
- How the theme toggle crossfade on the home page coordinates with the hero module, as long as it matches the mockup's behaviour.
- Testing approach. At minimum:
  - a build in CI that fails on broken internal links (Astro does not check this itself, so run a link checker over `dist/`)
  - a check that every old post URL and `/index.xml` exist in `dist/`
  - recording the day/night toggle with `record-toggle.mjs` before merge
