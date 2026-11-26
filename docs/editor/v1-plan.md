# Writing editor: v1 plan

v1 is the smallest editor Calvin would choose over Zed plus a terminal for a
whole post: write in it, see the real page, comment on lines, and get Claude's
replies and suggested edits in the margin. Everything follows
`architecture.md`. Mocks: https://claude.ai/artifact/F3qTinbSA29D4t63XC9wiZ

## In v1

- Opens on a drafts page (newest first) to pick a post with the keyboard, or
  straight on one named on the command line (`make write POST=<slug>`). Drafts
  can be deleted from it, and ⌥O goes back to it
- Source view (CodeMirror, Markdown and MDX highlighting) with autosave
- Preview view (the real `astro dev` in an iframe), swapped with ⌘\, keeping
  the scroll position on the same block
- Threads in the margin of both views: comment on a selection (⌘K), reply,
  resolve, move between them (J/K). The page thread for general comments (P)
- `@@` notes in the post show as threads
- Claude replies in threads and proposes edits with `suggest_edit`. Accept,
  reject or tweak each one (A/X/T)
- Status line: Preview|Source, words, minutes, open and resolved threads
- Outside edits to the post reload in the editor

## Later

- Critique progress in the page thread (`review.ts`), and accept all mechanical
  fixes (⇧A)
- Go to section (G), action all notes (⇧N), hide threads (Z)
- Images and figure components as thread targets (v1 anchors to text only)
- Anything for project pages

## Milestones

Each one ends with something Calvin can use and a passing `make verify`.

1. Write in it. `make write` starts the server and opens the drafts page.
   Source view, autosave, word count and reading time in the status line. The
   Playwright test opens a draft, types and checks the file on disk
2. See the page. The server starts and stops `astro dev`. The dev-only rehype
   plugin tags blocks with their source line. ⌘\ swaps views and keeps the same
   block in view
3. Comment. Anchors and threads in `domain/`, the JSON thread store, the margin
   in both views, ⌘K, J/K, R, D, the page thread, `@@` notes as threads, and
   threads that lose their place moving to the page thread
4. Talk to Claude. The `claude-agent` adapter runs the CLI headless and streams
   replies into threads. ⌃C stops it. Tested with recorded streams, plus the
   one live test
5. Suggested edits. `suggest_edit` becomes a suggestion card showing the
   change. Accept, reject, tweak, and "ask Claude to redo"
6. Outside edits. The file watcher reloads the buffer, or merges the change
   like a suggestion when there is unsaved typing

Milestones 1 and 2 involve no Claude at all, so the editor is useful for
writing before the hardest part lands.

## Decisions to make before milestone 4

- Sessions (decided). One Claude session per post, resumed with `--resume`,
  with the thread id and quoted anchor text in every message, so Claude keeps
  the whole post in mind
- How Claude reaches the tools (decided). The editor server serves its MCP
  tools over HTTP (instead of stdio), so a tool call lands in the same process
  that owns the threads. A separate stdio process would need its own way back
  to the server
- One Claude turn at a time. Messages sent while Claude is busy queue in order
- Skills. The CLI loads the repo's skills and `docs/writing.md` as it does in a
  terminal, so `/critique` and `/notes` work the same way. The editor adds a
  short system prompt saying edits go through `suggest_edit`

## Risks

- Preview anchoring is the most likely place to lose time: MDX components,
  tables and code blocks don't map one-to-one to source lines. Fall back to the
  nearest tagged block above
- Re-anchoring threads and suggestions as text changes has many edge cases.
  It lives in `domain/` with table-driven tests, written first
- The CLI's stream-json format may change between versions. The adapter's
  recorded-stream tests catch that when the CLI updates
