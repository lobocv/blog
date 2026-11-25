---
date: 2026-11-25
kind: architecture
---
# Use one Claude session per post, not one per thread

Decision record: explains why, as of its date. Code is authoritative for present behavior.

## Context

In the writing editor, Calvin talks to Claude in comment threads pinned to
text and in a page thread for general comments (eg "review the entire page for
flow"). The editor runs the `claude` CLI headless, and each run can resume an
earlier session with `--resume`, keeping that session's conversation. We had
to choose how threads map to sessions.

## Decision

- Each post has one Claude session. The editor stores its id with the post's
  threads and resumes it for every message.
- Every message names its thread and quotes the anchored text, so Claude knows
  which part of the post a reply belongs to.
- Claude takes one turn at a time. Messages sent while it is busy queue in
  order.

## Why

Most comments on a post depend on the rest of it. Whether a paragraph is too
long, repeats an earlier point or serves the thesis can only be judged with
the whole post and the brief in mind, and an answer in one thread often
affects another (eg cutting a section that another thread asks to expand). One
session keeps that context and what Calvin has already said about it. It also
matches how he works in a terminal today, so the skills (`/critique`,
`/notes`) behave the same in both places.

Running one turn at a time follows from sharing a session, and it keeps
suggested edits from different threads from being written against different
versions of the post.

## Rejected options

- One session per thread. Each thread would start without the brief, the
  rest of the post or earlier answers, and Claude could give conflicting
  advice in two threads.
- A new session for every message. It loses all conversation, so Calvin
  would have to repeat himself.
- Parallel turns in one session. Edits suggested at the same time could
  overlap, and the CLI does not support concurrent turns on one session.
