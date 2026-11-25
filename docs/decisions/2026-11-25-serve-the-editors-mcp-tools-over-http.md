---
date: 2026-11-25
kind: architecture
---
# Serve the editor's MCP tools over HTTP from the editor server

Decision record: explains why, as of its date. Code is authoritative for present behavior.

## Context

Claude works in the writing editor through the headless `claude` CLI, started
by the editor server with `--mcp-config`. It never writes to the post. Its only
ways to act are the editor's MCP tools: `suggest_edit`, `reply` and `comment`.
Each tool call has to end up as a suggestion card or a thread message on
Calvin's screen, and those live in the editor server, which owns the open
document, the threads and the WebSocket to the UI.

MCP servers can talk to the CLI over stdio, where the CLI starts the tool
server as its own process, or over HTTP, where the CLI connects to a server
that is already running.

## Decision

- The editor server serves the MCP tools over HTTP on its own port, next to
  the UI's routes and WebSocket.
- The `--mcp-config` the server passes to the CLI points at that URL.
- `infra/mcp-tools.ts` turns each tool call into a use-case call, the same way
  `server/http.ts` does for messages from the UI.

## Why

A tool call lands in the process that already holds the threads and the
document, so a suggestion reaches the margin with no extra hop and goes
through the same use cases and tests as anything Calvin does. With stdio,
the CLI would start a separate process that knows nothing about the editor's
state. That process would need its own way back to the server (eg another
HTTP call or a shared file), which is the HTTP design with an extra process
in the middle.

## Rejected options

- A stdio tool server that forwards calls to the editor server. More moving
  parts for the same result, and a second place where tool calls can fail.
- A stdio tool server that writes suggestions to a file the editor watches.
  It splits ownership of threads between two processes and makes ordering
  and errors harder to reason about.
