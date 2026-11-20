# Projects section design

## Intent

The site is growing past a blog into a personal site. We want a Projects section, separate from the blog, that turns work dormant in the WorkJournal archive (`writing/work-journal/`, a separate private repo) into public pages that build Calvin's brand.

- Work projects highlight Calvin's involvement and explain the system design at a high level, with nothing sensitive.
- Personal projects (later) highlight his approach and, where possible, a demo (a recording is fine).
- Pages should be beautiful and interactive and impress the reader.
- Comprehension matters most. Most readers skim, so the page works in layers: the top tells the whole story through visuals, and detail is there for readers who open it.
- Calvin wants to spend little time here (the blog is his focus), so the first project builds a reusable kit and later projects are mostly writing plus a data file.

The first page is the Hootsuite re-architecture (Avalanche), the most impactful project of Calvin's career.

## Goals

- `/projects/` index and `/projects/<slug>/` pages, visually part of the same site (tokens, day/night, horizon band, foliage)
- A reusable kit: impact strip, three-card summary, interactive system diagram, detail blocks, deep dives
- The Avalanche page, fully written
- Adding the next project needs no new components in the common case

## Non-goals

- Moving to `lobocv.com` and the `blog.lobocv.com` redirect repo (separate, later step)
- Redesigning the home page (part of the domain move). This step only adds a nav link
- Personal project pages and demo/video support (kit should not block it, but don't build it now)
- RSS for projects (feeds stay blog-only)

## Anti-goals

- Sensitive details leaking: coworker or manager names, internal politics, customer names, security details, unpublished business numbers
- A page that only works if you read it top to bottom
- Decorative visuals that don't explain anything
- A kit so general it slows down writing the next page

## Constraints

- Astro static site on GitHub Pages; vanilla TypeScript for client behaviour, no UI framework (matches the site)
- Colours come from the tokens in `src/styles/site.css` so day/night works with no re-render
- Must read well on a phone (diagrams included) and respect `prefers-reduced-motion`
- Works without JS: diagram renders as a static SVG and all detail content is visible inline
- Same prose rules as posts: no em-dashes, no banned AI words (see `AGENTS.md`)
- Project prose is written by Claude in Calvin's voice (this is an exception to the blog's "Calvin writes every sentence" rule, which stays in force for posts). `AGENTS.md` needs a short Projects section saying so, plus the sensitive-details checklist above

## Approaches

- A. A `projects` content collection in MDX plus a reusable component kit and a per-project architecture data file. Chosen. Higher cost on the first page, cheap after
- B. A hand-built bespoke page per project (like the home hero). Most wow per page, but expensive every time and inconsistent across pages. Rejected because Calvin wants low time investment
- C. Plain Markdown with static D2 diagrams and `<details>`. Cheapest and already supported, but not interactive and leans on reading. Rejected because it misses the goal

Calvin picked A, with the condition that the "before" architecture is optional (not every project has one).

## Design

### Content

- `src/content/projects/<slug>/index.mdx`, folder name is the slug (same convention as posts)
- `src/content/projects/<slug>/architecture.ts` exports the diagram data (typed, so mistakes fail `astro check`)
- Add `@astrojs/mdx`. MDX must run the same remark/rehype pipeline as posts (captions, heading anchors, Shiki theme)
- Frontmatter schema (`projects` collection in `src/content.config.ts`):
  - `title`, `kind: 'work' | 'personal'`, `org` (optional), `role`, `period` (string, eg "2020 to 2023"), `summary` (one-line outcome, used on the card and as meta description)
  - `problem`, `contribution`, `outcome`: one or two sentences each, rendered as the three summary cards
  - `impact`: optional list of `{ value, label }` (eg `{ value: "hours → seconds", label: "change stream lag" }`)
  - `order` (number, for the index), `draft` (same production behaviour as posts)

### Page layers (coarsest first)

1. Index card (5 seconds): title, org, role, period, one-line summary, and a small thumbnail of the project's diagram (rendered from the same data, no separate image)
2. Page top (60 seconds): title block, impact strip, the three summary cards, then the system diagram
3. Diagram exploration: click (or tab to) a component to open its detail panel. If a `before` view exists, a toggle flips between before and after. Named flows can be played to animate events moving through the system
4. Body: detail blocks and deep dives in reading order, for readers who scroll

```
┌──────────────────────────────────────────┐
│ Avalanche: re-architecting Impact        │
│ Hootsuite · Staff dev, lead, architect   │
│ [hours→seconds] [N services] [PHP gone]  │  impact strip
│ ┌Problem──┐ ┌What I did┐ ┌Outcome──┐     │  summary cards
│ └─────────┘ └──────────┘ └─────────┘     │
│ ┌ diagram ─────────────────┬─ panel ──┐  │  [Before|After] [▶ a post is collected]
│ │ Collectors → Kafka → ... │ De-dup.. │  │
│ └──────────────────────────┴──────────┘  │
│ ▸ Change stream sharding                  │  detail blocks / deep dives
│ ▸ Event de-duplicator                     │
│ ▸ Lessons                                 │
└──────────────────────────────────────────┘
```

Changed during the build: the panel sits below the diagram at every width, because a 6-column diagram beside a side panel shrank labels to about 6px. On phones and the diagram scales to width (wide diagrams scroll horizontally inside their frame rather than shrinking to unreadable).

### Kit components

- `ImpactStrip`: renders `impact` from frontmatter; hidden when empty
- `SummaryCards`: renders `problem`, `contribution`, `outcome`
- `SystemDiagram`: takes the architecture data
  - Nodes: `id`, `label`, `kind` (`service`, `store`, `queue`, `external`, `client`) for shape and colour, `x`/`y` on a coarse grid (explicit layout so diagrams stay controlled and phone-readable), optional `detail` (id of a `Detail` block)
  - Edges: `from`, `to`, optional `label`
  - `after` view is required; `before` view is optional. Toggle only renders when `before` exists. Nodes shared by id between views animate position; others fade
  - `flows` optional: named sequences of edges, played as a moving pulse along each edge in order (parallel steps allowed, which is what shows the event cascade)
  - Server-rendered SVG plus a small TS module for interaction. Nodes are focusable buttons with accessible names
- `Detail id title`: a block of MDX content. Rendered inline as a collapsible section in the body, and the same content is shown in the diagram panel when its node is clicked (one source of text)
- Detail blocks double as the deep dives (trade-offs, lessons, longer stories): a `Detail` that no node points to is just an expandable section. One component instead of two. Each takes a one-line `gist` shown while collapsed, so a skimmer reading only the titles and gists still gets the story. (The lint script bans the phrase "deep dive", so it never appears in visible text)

### Site changes

- Nav: add "Projects"
- `/projects/` index: work group then personal group; a group with no projects is not shown
- Social images: extend the OG generator to `/og/projects/<slug>.png`
- Sitemap includes project pages
- `Base.astro` `page` prop gains `'projects'` and `'project'`
- Extend `scripts/lint_post.py` (or add a flag) so project MDX gets the em-dash and banned-word checks

### Avalanche content

Sources: the Avalanche, change stream, Social Platform Registry, LiftMetrix deprecation and de-risking entries in `writing/work-journal/`.

- Before view: Collectors feeding a linear pipeline of stages over a simple queue (Kestrel), with the tangled cross-stage links that grew as edge cases were fixed
- After view: Collectors → ingestion topic (Kafka) → Content service → MongoDB → Change Stream reader → domain events (Kafka) → stream processors; MongoDB replicated to Elasticsearch as the read side (CQRS); Redis event de-duplicator; Social Platform Registry
- Flow: "a post is collected", showing one collection fanning out into parallel processing (the cascade that gave Avalanche its name)
- Detail blocks: event-driven design and domain boundaries; change stream sharding and the Redis lock (hours of lag to seconds); event de-duplicator with Redis sorted sets; Social Platform Registry; running both architectures in parallel and cutting over with feature flags
- Lessons block: (eg the registry should have been replicated config files, not a service)
- Leave out: all people's names, the internal disagreement over the rewrite plan, anything not already scale-level (eg "millions of posts" is fine)

## Decisions from Calvin (2026-11-20)

- Names are not sensitive: Hootsuite, Impact, LiftMetrix, Avalanche, Social Platform Registry and Collectors can all be used
- Role: Staff Software Developer, Team Lead and Architect for Enterprise Analytics, 2021 to 2025
- Calvin asked Claude to continue without him, make best guesses, and list what needs confirming (below)

## Calls made by Claude

- The Avalanche page ships with `draft: true` so Calvin reviews it before it goes public
- The Projects nav link, sitemap entries and index content only appear when at least one project is published, so production never advertises an empty section
- Project pages have no RSS, no reading time and no table of contents (the diagram and gists are the navigation)
- The lint script checks project pages (`make lint POST=projects/<slug>`) without the 2,000-word cap, since most of the text is collapsed
- The Avalanche summary, problem, outcome and impact text was written by Claude from the journal and needs Calvin's read for tone and accuracy

## To confirm with Calvin

All settled in Calvin's reviews (2026-11-20). Stage names are a simplification he's happy with; dates are 2021 to 2025 (the journal's 2020 is likely wrong); the comparison was a script that exported both systems and diffed fields. Each Detail block now opens with a small static diagram (`details.ts`, `<Detail diagram={...}>`).

## Left to the builder

- Exact visual styling of nodes, panel and cards within the site's tokens
- Animation timing and easing
- How the diagram data file is typed and validated
- Whether the index thumbnail is a simplified render or the full diagram scaled down
- Test approach (follow the repo's vitest setup for any pure logic, eg layout or flow sequencing)
