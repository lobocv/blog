---
date: 2026-11-25
kind: architecture
---
# Write the editor's backend in TypeScript

Decision record: explains why, as of its date. Code is authoritative for present behavior.

## Context

The writing editor (`docs/editor/architecture.md`) has a browser UI and a small
local server. The server saves the post, watches it for outside edits, stores
threads, starts `astro dev`, runs the `claude` CLI headless and serves the MCP
tools Claude uses to suggest edits. The UI is TypeScript because it runs in the
browser. The server could be TypeScript on Node or Go, which Calvin knows best
and uses for most of his other work (eg Trellis).

The hardest logic in the editor is anchoring: keeping threads and suggested
edits pinned to the right text as the post changes. It has to run in the
browser, on every keystroke, and on the server, when it applies an edit made in
another editor or stores a thread.

## Decision

- The server is TypeScript on Node, using Hono for HTTP, `ws` for the
  WebSocket and zod for message types.
- `editor/domain/` is plain TypeScript with no I/O, imported by both the
  server and the UI.
- The editor shares the blog's `package.json`, Vitest setup and `make verify`.

## Why

The strongest argument is that the domain code runs on both sides. In
TypeScript there is one copy of the anchoring rules and one set of tests for
them. In Go we would either write them twice and keep the two in step, or
compile Go to WebAssembly for the browser and debug across that boundary. Both
cost more than the server itself.

The rest of the repo is already TypeScript on Node. The editor reuses the
blog's code (eg the `@@` note grammar in `src/lib/notes.mjs` and the active
post lookup) and drives `astro dev` directly, with no second toolchain to
install, update or test.

The server is thin. It moves files and messages around for one user on one
machine, so Go's strengths (concurrency, speed, a single binary to ship) buy
us nothing here.

## Rejected options

- A Go server with the domain rules duplicated in TypeScript for the UI. The
  two copies would drift, and drift in anchoring shows up as threads or edits
  landing on the wrong text.
- A Go server with the domain compiled to WebAssembly. It keeps one copy, but
  adds a build step, a larger bundle and a boundary between UI and domain
  types on every keystroke.
- Doing anchoring only on the server. Every keystroke would need a round trip
  before the margin could update, which makes typing feel laggy.
