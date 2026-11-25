---
name: rescope
description: Bring the active post's brief up to date with where the post is actually going, and record what changed and why. Use when Calvin says /rescope, when a section is added, cut or moved, when the thesis, opening or ending changes, when a planned point is dropped, when a critique finds the draft no longer matches the brief, and before /critique structure and /ship.
---

# Keep the brief honest

The brief is a direction, not a contract. Posts change shape while Calvin
writes, and that's usually them getting better. This skill updates the brief to
match, so later critiques measure the post against where it is going now
rather than an old plan.

Read the brief (`writing/briefs/<slug>.md`) and the post.

## Compare

For each field (thesis, reader, takeaway, out of scope, budget, and any
supporting points), note whether the post:

- matches it
- has moved on from it (a different emphasis, a new section, a cut)
- has dropped something the brief promised

## Update

- Rewrite each field that moved so it describes the post as it is now, in
  Calvin's words from the draft where possible
- Add a dated entry under `## Changes` for each real change: what it was, what
  it is now, and why (from the conversation, or "not discussed")
- Don't touch the post, and never steer it back towards the old brief

## Ask only about what might be accidental

Most drift is deliberate. Flag a change only when the post lost something the
thesis or takeaway depends on (eg the brief's takeaway no longer appears
anywhere). One line each: what's missing, and whether it was intentional.

## Report

- One line per field that changed
- Any questions about possibly accidental drops
- The word count against the budget (`python3 scripts/lint_post.py <path>`)
