# Astro Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Hugo site with an Astro site that renders the approved mockups (`prototypes/mockups/`) from the real posts, keeps every old URL working and deploys to GitHub Pages.

**Architecture:** Static Astro site. Posts are a content collection, and pages render lists, cards and the table of contents at build time. Browser scripts are the mockup's own code moved into modules: the theme bootstrap, the horizon and foliage art, the hero scene, the posts filter, and code copy plus the contents-list highlight. The hero is ported as-is (canvas bake), not rewritten.

**Tech Stack:**
- Astro 5 with built-in Shiki
- `@astrojs/rss` and `@astrojs/sitemap`
- `remark-math` and `rehype-katex`
- Fontsource fonts
- Vitest for unit tests
- `linkinator` for link checks
- GitHub Actions to Pages

**Spec:** `docs/superpowers/specs/2026-11-19-astro-rebuild-design.md` (read it alongside this plan; it holds the reasons).

## Global Constraints

- `site: 'https://blog.lobocv.com'`, no base path, `build.format: 'directory'` (trailing-slash URLs like Hugo).
- Post URLs: `/posts/<slug>/`, where slug = the folder name under `src/content/posts/`.
- Theme: `data-time="day|night"` on `<html>`, set before first paint by `<script is:inline>`. Order: `?time=` param, then `localStorage.time`, then local hour (day when 7 ≤ hour < 19).
- Toggle button keeps `id="toggle"` (used by `prototypes/tools/record-toggle.mjs`).
- Drafts are excluded when `import.meta.env.PROD`, everywhere the collection is read.
- Dates are formatted in UTC, eg `Oct 1, 2022`.
- Reading time = ceil(words / 213).
- GA ID `G-6GL7S6YEB3`.
- GitHub `https://github.com/lobocv`, LinkedIn `https://www.linkedin.com/in/lobocv/`.
- Removed from mockups:
  - the Projects nav link and the "See projects" button
  - every `.subscribe` block, keeping its RSS line as a small link to `/index.xml`
  - share buttons and search
- The hero scene code is ported with drawing, seeds and `rng()` call order unchanged.
- Chat/commit conventions: commit after each task on branch `astro`, messages ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Theme flash: a reload with saved `night` during day hours must never paint a day frame first, on every page.
2. Category names with spaces in `?cat=`: `/posts/?cat=Developer%20Efficiency` must select that chip. An unknown `?cat=` must fall back to "All", not hide every post.
3. Old links: every URL in the saved live sitemap (minus the dropped list) must exist in `dist/`, including `/categories/<slug>/` redirects and image paths under `/posts/<slug>/`.
4. Day/night on post pages: code blocks, KaTeX maths and the horizon header must all switch colours with the toggle, with no unthemed (white) code panels at night.
5. Narrow screens (360 to 500px): the home hero, the TOC (hidden on narrow screens as in the mockup) and code blocks must not cause horizontal page scroll.

Each item has its test in the owning task, as noted.

---

### Task 1: Scaffold Astro and remove Hugo

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/pages/index.astro` (placeholder), `vitest.config.ts`
- Move: `static/*` to `public/` (`CNAME`, `favicon.ico`, `img/logo.jpg`)
- Delete: `config.toml`, `themes/` (submodule, via `git rm`), `.gitmodules`, `archetypes/`, `Dockerfile`, `run.sh`, `build_image.sh`
- Modify: `.gitignore` (add `node_modules/`, `dist/`, `.astro/`)

**Interfaces:**
- Produces: `npm run dev | build | preview | test | check:links | check:urls` scripts. The last two are filled in by Task 8 and can be placeholders until then.

- [ ] **Step 1:** `git switch -c astro` from `hero-prototype`.
- [ ] **Step 2:** Install the dependencies and dev dependencies:
  - `astro`
  - `@astrojs/rss`
  - `@astrojs/sitemap`
  - `remark-math`
  - `rehype-katex`
  - `katex`
  - `@fontsource-variable/fraunces`
  - `@fontsource-variable/inter`
  - `@fontsource-variable/inter-tight`
  - `@fontsource/jetbrains-mono`
  - `vitest` (dev)
  - `linkinator` (dev)
- [ ] **Step 3:** In `astro.config.mjs`, set:
  - `site`
  - `integrations: [sitemap()]`
  - `markdown.remarkPlugins: [remarkMath]` and `rehypePlugins: [rehypeKatex]`
  - `markdown.shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false, langAlias: { postgresql: 'sql' } }`. The themes get tuned in Task 6.
- [ ] **Step 4:** Remove the Hugo files listed above, and `git mv static/* public/`.
- [ ] **Step 5:** Run `npm run build`. Expected: it succeeds, and `dist/CNAME`, `dist/favicon.ico` and `dist/img/logo.jpg` exist.
- [ ] **Step 6:** Commit: "Scaffold Astro and remove Hugo".

### Task 2: Posts collection and helpers

**Files:**
- Move: `content/posts/<slug>/index.md` to `src/content/posts/<slug>/index.md`
- Move: the image files beside each post to `public/posts/<slug>/`
- Move: `content/about/index.md` to `src/content/pages/about.md`
- Delete: `content/` (including `_index.md`)
- Create: `src/content.config.ts`, `src/lib/posts.ts`
- Test: `src/lib/posts.test.ts`

**Interfaces:**
- Produces, from `src/lib/posts.ts`:
  - `type Post = CollectionEntry<'posts'>`
  - `getPosts(): Promise<Post[]>`: published only in PROD, newest first. A missing `date` sorts as today.
  - `readingMinutes(markdown: string): number`: strips code fences, HTML tags and Markdown punctuation, counts words, ceil(/213), minimum 1.
  - `formatDate(d: Date): string`: UTC, `en-US`, `{ month: 'short', day: 'numeric', year: 'numeric' }`.
  - `categorySlug(name: string): string`: lowercase, spaces to `-`.
  - `categoryCounts(posts: Post[]): [name: string, count: number][]`: count descending, then name ascending.
  - `neighbours(posts: Post[], id: string): { older?: Post; newer?: Post }`
  - `pickTocHeadings(h: {depth: number; slug: string; text: string}[]): typeof h`: picks the smallest depth ≥ 2 with at least 2 headings and returns those, or `[]`.
- Collection schema for `posts` (glob loader `*/index.md`, base `src/content/posts`, `generateId` returning the folder name):
  - `title` (string)
  - `draft` (boolean, default false)
  - `date` (date, optional)
  - `categories` (string[], default [])
  - `summary` (string, optional)
  - `feature` (`{ lang: string; code: string }`, optional)
  - a `superRefine` requiring `date` and `summary` when `draft` is false
- Collection `pages`, glob `*.md` in `src/content/pages`: `title`.

- [ ] **Step 1: Write the failing tests** in `src/lib/posts.test.ts`:
  - `formatDate(new Date('2022-10-01'))` returns `'Oct 1, 2022'`. Run it with `TZ=America/Los_Angeles` in the vitest config `env` to prove UTC.
  - `readingMinutes('word '.repeat(426))` returns `2`.
  - `readingMinutes('` + "```go\n" + 'x '.repeat(1000) + "\n```" + ` hi')` returns `1`, because code is excluded.
  - `categorySlug('Developer Efficiency')` returns `'developer-efficiency'`.
  - `categoryCounts` on posts with categories `[Golang, Golang, Databases, Architecture]` returns `[['Golang',2],['Architecture',1],['Databases',1]]`.
  - `neighbours` on three posts (newest first, ids a, b, c) with id `b` returns older `c` and newer `a`. For `a`, `newer` is undefined.
  - `pickTocHeadings` with depths `[3,3,3]` returns all three. With `[2,3,3]` it returns the two h3s. With `[2]` it returns `[]`. With `[2,2,3]` it returns the two h2s.
- [ ] **Step 2:** Run `npx vitest run`. Expected: it fails (module missing).
- [ ] **Step 3:** Implement `src/lib/posts.ts` and `src/content.config.ts` with the interfaces above. `getPosts` and `neighbours` take the collection entries, so the tests can pass plain objects shaped like entries.
- [ ] **Step 4:** Move the content.
  - Add `summary` to each of the six published posts. Copy the text verbatim from `prototypes/mockups/site.js` `POSTS`.
  - Add `feature` to `golang_testing`, using the code inside the `<pre>` in `prototypes/mockups/home.html` (lines 157 to 167) with the `<span>` tags stripped.
  - Rewrite every `src="https://blog.lobocv.com/posts/` to `src="/posts/`.
- [ ] **Step 5:** Edit `event_folding`:
  - Delete the inline `<style>`, the MathJax config `<script>` and the MathJax CDN `<script>`.
  - Rewrite each `<p style="text-align: center;">$...$</p>` as a `$$` display block.
  - Leave inline `$...$` in Markdown prose as is.
- [ ] **Step 6:** Run `npx vitest run` and `npm run build`. Expected: both pass, and the schema rejects nothing.
- [ ] **Step 7:** Commit: "Move posts into an Astro content collection".

### Task 3: Base layout, styles, theme and fonts

**Files:**
- Create:
  - `src/styles/site.css` (ported from `prototypes/mockups/site.css`)
  - `src/layouts/Base.astro`
  - `src/components/Nav.astro`
  - `src/components/Footer.astro`
  - `src/components/ThemeToggle.astro`
  - `src/scripts/theme.ts`

**Interfaces:**
- Produces:
  - `Base.astro`, with props `{ title: string; description?: string; page: 'home' | 'posts' | 'post' | 'about' | '404' }` and a default slot. `page` sets `aria-current` in the nav and a `data-page` attribute on `<body>` (used by home-only CSS such as `transition: none`).
  - `theme.ts` exports `initTheme(): void`, which wires `#toggle` and saves to `localStorage.time`. The home page replaces the toggle's click behaviour in Task 7 through `setThemeHandler(fn: (next: 'day'|'night') => void): void`.

- [ ] **Step 1:** Port `site.css` unchanged. Then add the font-family declarations for the Fontsource families, including Fraunces with `font-variation-settings`/`opsz` working, by importing `@fontsource-variable/fraunces/opsz.css`.
- [ ] **Step 2:** In `Base.astro`, the `<head>` holds:
  - the inline theme bootstrap, as `<script is:inline>`, copied from the `initial`/`apply` lines in `site.js` (lines 123 to 128) in the spec's order
  - meta description, canonical (`Astro.site` + path), the RSS `<link rel="alternate">` to `/index.xml`, and the favicon
  - the async gtag snippet
- [ ] **Step 3:** Port the nav and footer markup from `posts.html`, with links per the Global Constraints. There's no Projects link.
- [ ] **Step 4:** Build a throwaway `src/pages/index.astro` using `Base` with some text.
- [ ] **Step 5:** Review Focus 1 test. Run `npm run build && npx astro preview`. Load `/?time=night` in headless Chrome with `--dump-dom`. Expected: `<html data-time="night">` before any module script. Also check that `dist/index.html` has the bootstrap inline in `<head>`, before the stylesheet `<link>`.
- [ ] **Step 6:** Commit: "Base layout, theme bootstrap, nav and footer".

### Task 4: Shared landscape art

**Files:**
- Create:
  - `src/scripts/art/gen.ts` (the seeded generator `gen(seed)` from `site.js`)
  - `src/scripts/art/horizon.ts`
  - `src/scripts/art/band.ts` (`foliageBand`, `sideFoliage`, `topo`)
  - `src/scripts/art/flora.ts`

**Interfaces:**
- Produces:
  - `horizon(el: HTMLElement): void`
  - `foliageBand(el: HTMLElement): void`
  - `sideFoliage(el: HTMLElement, height: number): void`
  - `topo(el: HTMLElement, width: number, height: number): void`
  - `flora(rng: () => number): { clump; clumpD; bush; stone; P }`
- All are copied from `site.js` with bodies unchanged, apart from imports. The `POSTS`, `fmt` and `row` parts of `site.js` are not ported (Task 5 replaces them with components).

- [ ] **Step 1:** Port the functions. Keep `rng` call order and constants byte-identical, and diff each body against `site.js` to confirm.
- [ ] **Step 2:** Run `npx astro check`. Expected: no errors.
- [ ] **Step 3:** Commit: "Port landscape art helpers from the mockups".

### Task 5: Posts index

**Files:**
- Create: `src/pages/posts/index.astro`, `src/components/PostRow.astro`, `src/scripts/filter.ts`
- Test: `src/scripts/filter.test.ts`

**Interfaces:**
- Consumes: `getPosts`, `categoryCounts`, `formatDate`, `readingMinutes`, `horizon`, `Base`.
- Produces:
  - `PostRow.astro`, with props `{ post: Post; minutes: number }`, rendering the mockup's `row()` markup with `data-cats="A|B"`. Task 7 reuses it.
  - `filter.ts` exports `initialCategory(search: string, names: string[]): string` (returns the decoded `cat` if it is in `names`, else `'All'`) and `initFilter(root: HTMLElement): void`.

- [ ] **Step 1: Write the failing tests:**
  - `initialCategory('?cat=Developer%20Efficiency', ['Golang','Developer Efficiency'])` returns `'Developer Efficiency'`.
  - `initialCategory('?cat=Nope', ['Golang'])` returns `'All'`.
  - `initialCategory('', ['Golang'])` returns `'All'`.

  These cover Review Focus 2.
- [ ] **Step 2:** Run `npx vitest run src/scripts/filter.test.ts`. Expected: it fails.
- [ ] **Step 3:** Implement the page and scripts.
  - The markup comes from `posts.html`, rendered at build time: year sections, the "All" chip first, then `categoryCounts` order.
  - The filter click behaviour is copied from `posts.html` lines 72 to 82.
  - On load, press the chip named by `initialCategory`.
  - The `.subscribe` block becomes the RSS line only.
- [ ] **Step 4:** Run the tests (expected: pass), then `npm run build`. Screenshot `/posts/?time=day` and `/posts/?time=night` at 1440 and 390 wide, and compare to `prototypes/mockups/posts.html`. Expected: same layout, apart from the removed signup.
- [ ] **Step 5:** Commit: "Posts index with category filter".

### Task 6: Post page, About and 404

**Files:**
- Create:
  - `src/pages/posts/[slug].astro`
  - `src/pages/about.astro`
  - `src/pages/404.astro`
  - `src/components/AuthorBlock.astro`
  - `src/components/Toc.astro`
  - `src/scripts/post.ts`
  - `src/styles/code.css`

**Interfaces:**
- Consumes: `getPosts`, `neighbours`, `pickTocHeadings`, `formatDate`, `readingMinutes`, `horizon`, `Base`.
- Produces: `AuthorBlock.astro`, with props `{ variant: 'post' | 'home' }`, holding the two bios from the mockups (the home bio comes from `home.html`, the post bio from `post.html`). Task 7 reuses it.

- [ ] **Step 1:** Build `[slug].astro` from the `post.html` markup:
  - the crumb shows the first category as `#<categorySlug>`, and the lede is `summary`
  - the meta shows the date, minutes and "Calvin Lobo"
  - the body is `<Content />`
  - the pager uses `neighbours`, with the "Back to all writing" fallback
  - the TOC comes from `pickTocHeadings(headings)` and is omitted when empty
- [ ] **Step 2:** In `post.ts`:
  - On each `pre[data-language]`, insert `<span class="lang">` (only when the language is not `plaintext`) and the Copy button, matching the mockup's behaviour (lines 396 to 403 of `post.html`).
  - Add the TOC current-section highlight and the progress bar from lines 405 to 418.
- [ ] **Step 3:** In `code.css`, select `--shiki-light`/`--shiki-dark` by `:root[data-time]`. Tune the panel background, border and token colours so they match the mockup's `.post-body pre` at both themes. Load `katex/dist/katex.min.css` on posts only.
- [ ] **Step 4:** Build `about.astro`, rendering the `pages` entry `about` with the slim horizon, post typography and `AuthorBlock variant="post"`. Build `404.astro` with the slim horizon, "Page not found" and a link to `/posts/`.
- [ ] **Step 5:** Verify (this covers Review Focus 4 and part of 5). Run `npm run build` and screenshot these at day and night:
  - `/posts/golang_testing/`
  - `/posts/event_folding/`
  - `/about/`
  - `/404.html`

  Expected:
  - code panels match the mockup at both themes
  - every `event_folding` formula renders as KaTeX, with no literal `$`
  - no horizontal scroll at 390 wide
  - the TOC lists h3s on `event_folding`
- [ ] **Step 6:** Commit: "Post, About and 404 pages".

### Task 7: Home page and hero

**Files:**
- Create:
  - `src/pages/index.astro` (replacing the placeholder)
  - `src/scripts/hero/scene.ts` (`buildScene`, `DAY_PALETTE`, the layer helpers)
  - `src/scripts/hero/bake.ts` (`frame`, `extent`, `bake`, `bakeScene`, `ResizeObserver`)
  - `src/scripts/hero/index.ts` (`ensure`, `show`, `setTheme`, `onOrb`, the grain, the scroll `update`, the nav `solid` toggle)
  - `src/styles/home.css` (from `home.html` lines 11 to 110)

**Interfaces:**
- Consumes:
  - `flora`, `foliageBand`, `sideFoliage` and `topo` (Task 4)
  - `PostRow` (Task 5)
  - `AuthorBlock` (Task 6)
  - `setThemeHandler` (Task 3)
  - `getPosts`, `categoryCounts`, `formatDate`, `readingMinutes`
- Produces: `initHero(root: HTMLElement): void`, called from the home page script.

- [ ] **Step 1:** Port `home.html` lines 201 to 802 into the three hero files. The bodies stay unchanged. References to `Site.x` become imports. The toggle is registered with `setThemeHandler(setTheme)`.
- [ ] **Step 2:** Build the home markup from `home.html` lines 112 to 184:
  - the feature card is the newest post, and the code panel is the `feature` highlighted with Shiki's `codeToHtml` (same themes as Task 1), omitted when there's no `feature`
  - `PostRow` for posts 2 to 5
  - topic chips use `categoryCounts` and link to `/posts/?cat=<encodeURIComponent(name)>`
  - `AuthorBlock variant="home"`, with "About me →" going to `/about/`
  - the RSS line in place of the subscribe block
  - no "See projects" button
- [ ] **Step 3:** Pixel check:
  - Make the throwaway `?p=` test copy as described in `memory: verify-animations-by-recording` and the handoff (or a dev-only query handler in `index.ts`, removed before commit).
  - Screenshot `/?time=day` and `/?time=night` at p = 0, 0.5 and 1, at 1440x900, and compare against the same shots of `prototypes/mockups/home.html`.
  - Expected: the scene art is identical.
- [ ] **Step 4:** Flicker check. Run `npx astro preview`, then `node prototypes/tools/record-toggle.mjs http://localhost:4321/ /tmp/rec-astro 2` in both directions. Expected: no broken frames, and about 250 frames each way, like the mockup (263/251).
- [ ] **Step 5:** Review Focus 5. Screenshot `/` at 390 and 500 wide, day and night. Expected: no horizontal scroll, and the hero copy readable.
- [ ] **Step 6:** Commit: "Home page with the ported wolf hero".

### Task 8: Feeds, redirects and URL checks

**Files:**
- Create:
  - `src/pages/index.xml.ts`
  - `src/pages/posts/index.xml.ts`
  - `src/pages/sitemap.xml.ts`
  - `src/lib/feed.ts`
  - `tests/old-urls.txt`
  - `scripts/check-urls.mjs`
- Modify: `astro.config.mjs` (add `redirects`)

**Interfaces:**
- Produces: `feed(context): Promise<Response>` in `feed.ts`, shared by both feed endpoints. Items carry:
  - `title`
  - `pubDate`
  - `description: summary`
  - `link`: the full URL with trailing slash

- [ ] **Step 1:** Save the live URL list. Run `curl -s https://blog.lobocv.com/sitemap.xml`, extract the `<loc>` paths, and drop paging, `/index.json` and `/categories/*/index.xml`. Also add `/index.xml`, `/posts/index.xml` and each image path under `/posts/<slug>/`. Write the result to `tests/old-urls.txt`, one path per line.
- [ ] **Step 2:** Write `scripts/check-urls.mjs`. For each path, it checks that `dist/<path>` exists, treating a trailing `/` as `index.html`, and exits 1 listing the misses. Wire it as `npm run check:urls`, and `check:links` as `linkinator ./dist --recurse --skip "^https?://(?!blog\\.lobocv\\.com)"`.
- [ ] **Step 3:** Run `npm run build && npm run check:urls`. Expected: it fails, listing the feeds and `/categories/...` paths.
- [ ] **Step 4:** Implement the pieces:
  - the feed endpoints
  - `sitemap.xml.ts`, listing `/`, `/posts/`, `/about/` and each post URL
  - `redirects` with an entry for `/categories` going to `/posts/`, plus one for each category in use, from `/categories/<categorySlug>` to `/posts/?cat=<encodeURIComponent(name)>`. Generate the list in `astro.config.mjs` by reading the front matter with `fs`, or hard-code the four in use with a comment. Hard-coding is acceptable, given how small the list is.
- [ ] **Step 5:** Run `npm run build && npm run check:urls && npm run check:links`. Expected: all pass (this is Review Focus 3). Then diff the `<guid>` values in `dist/index.xml` against `curl -s https://blog.lobocv.com/index.xml`. Expected: the six published posts have identical guids.
- [ ] **Step 6:** Commit: "RSS feeds, sitemap, category redirects and URL checks".

### Task 9: Deploy workflow

**Files:**
- Modify: `.github/workflows/gh-pages.yml`

- [ ] **Step 1:** Replace the build job. It keeps the triggers (push to `master`, `workflow_dispatch`), permissions and concurrency, then runs these steps:
  - `actions/checkout@v4` (no submodules)
  - `actions/setup-node@v4` with `node-version: lts/*` and `cache: npm`
  - `npm ci`
  - `npm test`
  - `npm run build`
  - `npm run check:urls`
  - `npm run check:links`
  - `actions/configure-pages@v5`
  - `actions/upload-pages-artifact@v3` with `path: dist`

  The deploy job uses `actions/deploy-pages@v4`.
- [ ] **Step 2:** Run `npx --yes @action-validator/cli .github/workflows/gh-pages.yml`, or failing that, an `actionlint` pass. Expected: no errors. Running it on GitHub happens at merge, and is not verified here.
- [ ] **Step 3:** Commit: "Deploy the Astro build to GitHub Pages". Push branch `astro`. Do not merge to `master`: that's the owner's call, after they review it in the browser.
