# Writing editor: architecture

The writing editor is a small local app for writing posts with Claude: the post
on one side, comment threads and suggested edits in the margin, and Claude
working through the same skills as the CLI. This doc sets the structure every
change to it follows. Read it before changing anything under `editor/` or
`shared/`.

The guiding rule: keep each change small and testable without adding layers the
app doesn't need. It is a single-user tool that runs on one machine.

UI mocks: https://claude.ai/artifact/F3qTinbSA29D4t63XC9wiZ. What v1 includes and the order it is built in: `v1-plan.md`.

## Layout

One repo, one `package.json`. The editor lives in `editor/`, next to the blog.

```
editor/
  main.ts            wires adapters into use cases, starts the API and the Vite dev
                     server for the UI (which proxies /api/). No logic
  protocol.ts        browser <-> server message types (zod), used by both sides
  domain/            pure TypeScript. No I/O, runs in Node and the browser
    document.ts        text, headings, word count and reading time
    front-matter.ts    the front matter as fields, written back in one format
    post.ts            drafts, titles, valid slugs and new drafts
    ideas.ts           the bullets in writing/ideas.md: list, add, remove
    anchor.ts          pins a thread to quoted text plus a line hint, re-finds it after edits
    figure.ts          what a thread on a figure points at: the component's file or the image
    thread.ts          threads, replies, open and resolved
    suggestion.ts      proposed edits: apply, tweak, keep in place as the text changes
    review.ts          critique checklist progress
  app/               use cases, one per file, and the ports they need
    ports.ts           PostLibrary, ThreadStore, IdeasFile, Agent, Preview, Clock
    errors.ts          NotFound and Refused, which the server turns into 404 and 409
    list-posts.ts, create-draft.ts, ideas.ts, open-post.ts, save-post.ts, delete-draft.ts, threads.ts, ...
    conversation.ts    Claude's turns: one at a time per post, streamed, stoppable
    testing/fakes.ts   in-memory implementation of every port
  infra/             the only code that touches the outside world
    fs-post-library.ts     reads and writes posts, watches for outside edits, moves
                           deleted drafts to .trash/
    json-thread-store.ts   writing/threads/<slug>.json, with the post's Claude session
    fs-ideas-file.ts       writing/ideas.md, the same file /idea adds to
    claude-agent.ts        runs the claude CLI headless and parses its stream
    testdata/              recorded claude streams and a fake claude that replays them
    mcp-tools.ts           the suggest_edit tool Claude calls, as a small MCP server over
                           HTTP. Each turn gets only these tools (--strict-mcp-config)
    astro-preview.ts       starts and stops astro dev
    contracts/             one shared test suite per port
  server/
    http.ts            routes, and server-sent events for Claude's replies. Turns
                       requests into use-case calls
  ui/
    main.tsx           `/` lists the posts (drafts first), `/?post=<slug>` edits a post,
                       `/?ideas` lists the ideas
    api.ts (fetch calls), autosave.ts, format.ts, keymap.ts, theme.css
    thread-state.ts    the open post's threads and notes, selection and composer, as signals
    components/        Composer, ThreadCard, Margin, PageThread, StatusLine, KeySheet,
                       SectionPicker, FrontMatterForm
    views/             PostsView, IdeasView, EditorView, PreviewView (iframe plus anchors),
                       SourceView (CodeMirror)
shared/              code the blog build and the editor both use, moved here when
                     the editor first needs it
  reading.ts           word count and reading time, so the editor matches the site
  notes.ts             the `@@` note pattern
  preview.ts           the post's URL, and the bridge script Astro injects into the
                       preview page plus the messages it exchanges with the editor
e2e/
  editor.spec.ts     posts page, typing and saving, deleting, threads
  preview.spec.ts    Source and Preview swap, on a temporary copy of the site
```

## Layers and what they may import

| Layer | Holds | May import |
|---|---|---|
| `domain` | The rules: anchoring, suggestions, threads, stats | `shared` only |
| `app` | Use cases and port interfaces | `domain` |
| `infra` | Adapters for files, Claude, Astro | `app` (ports), `domain`, Node APIs, libraries |
| `server` | HTTP handlers and the event stream | `app`, `protocol` |
| `ui` | Browser code | `domain`, `protocol`, `shared` |
| `protocol.ts` | Message types | `domain` |
| `main.ts` | Wiring | Everything |
| `shared` | Code the blog and editor share | Nothing in `editor/` |
| The blog (`src/`) | The site | `shared`, never `editor/` |

- `editor/architecture.test.ts` enforces this table by scanning each folder's
  imports. If a change needs to break a rule, change the design here first,
  then the table in the test
- Only `infra`, `server`, `main.ts` and `shared` may import Node built-ins
  (`node:fs`, `child_process`, ...). Tests are exempt
- The UI never imports `app` or `infra`. It talks to the server only through
  `protocol.ts`, so it never knows how saving or Claude work
- `domain` runs in the browser too, so threads re-anchor as Calvin types without
  a round trip to the server
- Ports are plain TypeScript interfaces and `main.ts` passes adapters in by hand.
  No dependency injection framework

## How the pieces fit

- Source shows the front matter as a form (title, draft, date, categories,
  summary, and any other keys as YAML) above the text. Each change rewrites the
  whole block in one format, so a typo can't break the page. The lines stay in
  CodeMirror's document but hidden (`views/post-head.ts`, which hides MDX
  imports too, since they only place figures), so line
  numbers don't change, and typing can't reach them; only the form, outside
  edits and undo can. Front matter the form can't read stays visible as text to
  fix by hand
- The `.mdx` file on disk is the only copy of the post. The UI saves about
  half a second after typing stops and on every view or window change. The
  status line shows something only when a save fails
- The preview is the real `astro dev` server in an iframe, so it always
  matches the site and reloads when the post is saved. The editor starts it with
  `EDITOR_PREVIEW=1` and `--ignore-lock` (so it runs beside `make dev`), which
  turns on two things in `astro.config.mjs`:
  - `src/lib/source-lines.mjs`, a rehype plugin that tags rendered blocks with
    their line in the post file (`data-line`), so threads and scrolling can
    anchor to the preview
  - the bridge from `shared/preview.ts`, which talks to the editor with
    `postMessage`: scroll to a line, report where each block is on screen,
    highlight the blocks with threads, and pass on keys (a focused iframe gets
    them instead of the editor) along with the selection for ⌘K
- The preview keeps its full width. Threads float over its right edge, level
  with the block holding their first line. ⌘K there quotes the selected words
  when the source has them as typed, otherwise the block's first line
  (`anchorNear` in `domain/anchor.ts`)
- Figures can be commented on like words. The rehype plugin tags images with
  `data-figure`, and wraps MDX components (eg `<ContextStack />`) and raw HTML
  images in a tagged div, since they render as whatever they output. Clicking
  one in the preview picks it, and ⌘K comments on the line that places it. In
  Source, ⌘K with the cursor on that line does the same. Claude is told which
  component file or image the thread is about (`domain/figure.ts`). Figure
  components are code rather than Calvin's prose, so Claude edits them directly
  (`src/components/`) and the preview reloads
- Neither runs in a build, so the built site is unchanged. ⌘\ swaps views and
  keeps the same block at the top: the source's top line goes to the preview,
  and the preview's top block comes back
- Claude never writes to the post. It runs as the headless `claude` CLI
  (Calvin's own login) with `--mcp-config` pointing at the editor's tools, and
  the post file is blocked from its Edit and Write tools. Its only way to change
  the post is `suggest_edit`, which becomes a suggestion Calvin accepts, rejects
  or tweaks. Accepting applies the edit like his own typing (⌘Z undoes it), and
  the thread's quote follows the edit so the thread keeps its place. This keeps the
  three edit levels from `docs/writing.md` in the tool itself and means his
  typing and Claude's edits never collide
- Every comment and reply Calvin sends goes to Claude, one turn at a time per
  post (later messages wait their turn). Each turn resumes the post's session
  (`--resume`), names the thread and quotes its words. The reply streams into
  the thread and is saved when it finishes. ⌃C stops it and keeps what it wrote
- Threads live in `writing/threads/<slug>.json` (gitignored, so they stay on
  one machine), anchored by quoted text plus
  a line hint. If the quoted text disappears, the thread moves to the page
  thread, marked as having lost its place. `@@` notes stay in the post and show
  as threads
- Outside edits (Zed, Claude Code in a terminal) reach the editor through the
  file watcher and the event stream. With no unsaved typing the text reloads.
  With unsaved typing the two are merged when they change different lines
  (`domain/merge.ts`); when they change the same lines, Calvin chooses which to
  keep. Either way ⌘Z undoes the reload
- History is the editor's undo for recent changes and git for the rest. No
  automatic commits

## Testing

Tests sit next to the code as `*.test.ts` and run in the existing Vitest setup,
split into projects: `blog`, `editor-node` and `editor-dom`.

| Layer | How it's tested |
|---|---|
| `domain` | Unit tests, table-driven. Most of the tests live here, because this is where the hard logic is |
| `app` | Each use case against the fakes in `app/testing/fakes.ts`. No disk, no network, no Claude |
| `infra` | The contract suite for each port runs against both the fake and the real adapter (the filesystem one in a temp dir), so the fakes can't drift from reality. The Claude adapter is tested with recorded stream files. One live test runs only with `EDITOR_LIVE=1` |
| `ui` | Components with Testing Library in happy-dom: the margin, thread cards, the keymap |
| End to end | One Playwright test with a scripted fake agent: type, receive a suggestion, accept it, check the file on disk. Deterministic and free |

- `make verify` runs every Vitest project. The Playwright test runs in
  `make verify-editor`, so the blog's deploy doesn't depend on it
- A bug fix starts with a failing test in the lowest layer that can show it

## Making a change

- A new action: one use-case file in `app/`, a message in `protocol.ts`, a key in
  `ui/keymap.ts`. Test the use case against the fakes
- A new rule (eg how anchors re-attach): `domain/`, with unit tests. Nothing else
  should need to change
- A new outside dependency (eg another way to run Claude): a new adapter in
  `infra/` that passes the existing contract suite, wired in `main.ts`
- Keep files small and named after what they do. Split a file when it holds two
  ideas, not before

## UI conventions

- The editor is keyboard first. In Preview an action is a bare letter; in Source,
  where Calvin is typing, it is the same letter with ⌥ (which works in Preview
  too). The only ⌘ shortcuts are ⌘\ (preview/source), ⌘K (comment on
  selection) and ⌘/ (page thread, also / or ⌥/). H or ⌥H (also the Keys button
  and ? in Preview) shows the shortcut sheet, which lists them from
  `ui/keymap.ts`
- The key that opens something closes it again (⌘/, ⌥/, ⌘K, ⌥R, ⌥T, ⌥H). These
  keys reach the editor from a message box too (`reachesEditor` in
  `ui/keymap.ts`); every other key typed there is text
- Don't bind shortcuts the browser or macOS keeps for itself (⌘ with T, N, W, R,
  L, P, H, 1-9 or `) or that edit text (⌘⌫). macOS takes ⌘` to switch windows before
  Chrome sees it. The sheet shows the last key the editor received, to check a
  new binding on the real machine. Match keys by `event.code`, since ⌥ plus a letter
  types a special character on macOS
- Key handlers read signals, not component state, and attach in `useLayoutEffect`,
  so a key pressed straight after another (or after the page appears) sees its
  effect
- Deleting asks first, and only drafts can be deleted. Deleted drafts go to
  `.trash/` with their brief, images and threads, so they can be moved back
- Nothing on screen that doesn't help the writing: no explanatory text, no
  counters that can't be acted on
- Colours follow the roles in `docs/figures.md`: green for Claude and accepted
  text, amber for Calvin's notes, red for deletions

## Stack

- UI: Vite, Preact with signals, CodeMirror 6
- Server: Hono on Node (server-sent events, since only the server pushes), zod (why TypeScript: `docs/decisions/2026-11-25-write-the-editor-backend-in-typescript.md`)
- Tests: Vitest (with happy-dom and Testing Library), Playwright for the one
  end-to-end test
- `make write` starts `astro dev` and the editor server and opens the editor in
  its own browser window

## Decided against, for now

- A monorepo or workspaces. One `package.json` is enough while the editor and the
  blog share a single dependency tree
- A shared component library for the blog and the editor. Astro components and
  editor components don't overlap; the colour roles are the shared part
- Real-time collaboration (CRDTs, Claude typing live). Suggestions cover the same
  need with far less code
- A database or event sourcing. Threads are one JSON file per post
- WYSIWYG editing of MDX. The source view plus the live preview avoids round-trip
  bugs with components and front matter
