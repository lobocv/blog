---
name: ship
description: Final pre-publish pass on the active post. Runs the mechanical checks, then a last read against the brief, and reports a pass/fail list. Use when Calvin says /ship or asks if a post is ready to publish.
---

# Final pass on the active post

Find the active post and read its brief (see "Where things live" in `docs/writing.md`).

1. Run `python3 scripts/lint_post.py <path> --links` and report the result
2. Check by reading:
   - The opening states the thesis from the brief
   - Every section serves the thesis
   - The ending lands on the takeaway without summarizing the post
   - Code snippets are correct. Compile or run Go snippets in a scratch
     directory where practical
   - Front matter: title, date, categories, and a one-line `summary` (required to publish; the build fails without it)
   - Any leftover outline comments (`<!-- ... -->`), `@@` notes, figure placeholders or TODOs
   - The brief matches the post. If not, run `/rescope` so it records what changed
   - The slug matches the title
3. Report a short pass/fail list. Apply mechanical fixes directly; anything bigger follows the edit levels in `docs/writing.md`

When everything passes, tell Calvin the remaining steps: set `draft: false`,
update the date, commit and push. Don't flip `draft` yourself unless he asks.

Afterwards, ask whether anything from this post belongs in `writing/feedback.md`.
