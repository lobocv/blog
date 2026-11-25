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
  main.ts            wires adapters into use cases and starts the server. No logic
  protocol.ts        browser <-> server message types (zod), used by both sides
  domain/            pure TypeScript. No I/O, runs in Node and the browser
    document.ts        text, edits, word count and reading time
    anchor.ts          pins a thread to quoted text plus a line hint, re-finds it after edits
    thread.ts          threads, replies, open and resolved
    suggestion.ts      proposed edits: apply, tweak, keep in place as the text changes
    review.ts          critique checklist progress
  app/               use cases, one per file, and the ports they need
    ports.ts           DocumentStore, ThreadStore, Agent, Preview, Clock
    accept-suggestion.ts, tweak-suggestion.ts, add-comment.ts, ...
    testing/fakes.ts   in-memory implementation of every port
  infra/             the only code that touches the outside world
    fs-document-store.ts   reads and writes the .mdx, watches for outside edits
    json-thread-store.ts   writing/threads/<slug>.json
    claude-agent.ts        runs the claude CLI headless and parses its stream
    mcp-tools.ts           the suggest_edit, reply and comment tools Claude calls
    astro-preview.ts       starts and stops astro dev
    contracts/             one shared test suite per port
  server/
    http.ts            routes and a WebSocket. Turns messages into use-case calls
  ui/
    main.tsx, keymap.ts, theme.css
    components/        Kbd, Button, ThreadCard, Margin, PageThread, StatusLine
    views/             PreviewView (iframe plus anchors), SourceView (CodeMirror)
shared/              code the blog build and the editor both use, moved here when
                     the editor first needs it (eg the @@ note grammar in src/lib/notes.mjs)
e2e/
  editor.spec.ts     one Playwright smoke test
```

## Layers and what they may import

| Layer | Holds | May import |
|---|---|---|
| `domain` | The rules: anchoring, suggestions, threads, stats | `shared` only |
| `app` | Use cases and port interfaces | `domain` |
| `infra` | Adapters for files, Claude, Astro | `app` (ports), `domain`, Node APIs, libraries |
| `server` | HTTP and WebSocket handlers | `app`, `protocol` |
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

- The `.mdx` file on disk is the only copy of the post. The UI saves about
  half a second after typing stops and on every view or window change. The
  status line shows something only when a save fails
- The preview is the real `astro dev` server in an iframe, so it always
  matches the site. A dev-only rehype plugin tags rendered blocks with their
  source line so threads can anchor to the preview. It runs only when the editor
  starts Astro, so the built site is unchanged
- Claude never writes to the post. It runs as the headless `claude` CLI
  (Calvin's own login) with `--mcp-config` pointing at the editor's tools, and
  the post file is blocked from its Edit and Write tools. Its only way to change
  the post is `suggest_edit`, which becomes a suggestion Calvin accepts, rejects
  or tweaks. Accepting applies the edit like his own typing. This keeps the
  three edit levels from `docs/writing.md` in the tool itself and means his
  typing and Claude's edits never collide
- Threads live in `writing/threads/<slug>.json`, anchored by quoted text plus
  a line hint. If the quoted text disappears, the thread moves to the page
  thread, marked as having lost its place. `@@` notes stay in the post and show
  as threads
- Outside edits (Zed, Claude Code in a terminal) reach the editor through the
  file watcher. With no unsaved typing the buffer reloads, otherwise the change is
  merged the same way suggestions are
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
  where Calvin is typing, it is the same letter with ⌥. The only ⌘ shortcuts are
  ⌘\ (preview/source), ⌘K (comment on selection) and ⌘/ (shortcut sheet)
- Don't bind shortcuts the browser keeps for itself (⌘ with T, N, W, R, L, 1-9 or
  `) or that edit text (⌘⌫). Match keys by `event.code`, since ⌥ plus a letter
  types a special character on macOS
- Nothing on screen that doesn't help the writing: no explanatory text, no
  counters that can't be acted on
- Colours follow the roles in `docs/figures.md`: green for Claude and accepted
  text, amber for Calvin's notes, red for deletions

## Stack

- UI: Vite, Preact with signals, CodeMirror 6
- Server: Hono on Node, `ws`, zod (why TypeScript: `docs/decisions/2026-11-25-write-the-editor-backend-in-typescript.md`)
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
