# AGENTS.md

Calvin's personal site (www.lobocv.com): blog posts, project pages, the Astro
site that builds them, and the writing editor in `editor/`.

## Read the guide for the task first

Work here is either writing content or building software. Read the guide that
matches the task before starting, and both when a task spans two.

| Task | Guide |
|---|---|
| Posts, briefs, ideas, and the writing skills (`/scope`, `/notes`, `/critique`, `/ship`, ...) | `docs/writing.md` |
| Project pages (`src/content/projects/`) | `docs/writing.md`, "Project pages" |
| Anything in Calvin's voice: posts, project pages, home and journey copy, bios | `docs/voice.md` |
| Figures and diagrams, for posts or project pages | `docs/figures.md` |
| The Astro site: `src/` outside content, `astro.config.mjs`, `scripts/` | `docs/site.md` |
| The writing editor: `editor/`, `shared/` | `docs/editor/architecture.md` |
| Why an architecture choice was made | `docs/decisions/` (one record per decision, named by date) |

## Rules for every task

- Post prose is Calvin's (see "The one rule" in `docs/writing.md`). Code work
  never writes or rewrites it as a side effect (eg use existing text for test
  fixtures)
- No em-dashes in anything that ships: posts, pages, UI copy, docs
- Run `make verify` before pushing

## Commands

Run `make` to list targets. The common ones:

- `make dev`: local server on http://localhost:4321, drafts included
- `make verify`: everything the deploy checks (unit tests, `astro check`, clean
  build, old-URL check, link check)
- `make deploy`: refuses off `master` or with uncommitted changes, runs `verify`,
  then pushes
- `make write` / `make write POST=<slug>`: open the writing editor on the posts
  page, or straight on a post. `make verify-editor` runs its tests, including the browser test
- `make lint` / `make lint POST=<slug>`: mechanical checks on a post
  (`scripts/lint_post.py`)
- Single test file: `npx vitest run src/lib/rehype.test.ts`; single test: add
  `-t "<test name>"`

Node 23 or later is required: `scripts/check-urls.mjs` imports `src/lib/urls.ts`
directly.
