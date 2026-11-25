---
name: notes
description: Action the @@ notes Calvin left in the active post (eg "@@ should a figure go here?", "@@ think of a better word @@", "@@ not a fan of this phrasing"). Use when Calvin says /notes, "check my notes", "action the notes", or mentions notes he left in the post.
---

# Action the notes in the active post

Find the active post (see "Where things live" in `docs/writing.md`) and list every
note in it:

```sh
grep -n "@@" <path>
```

A note starts with `@@` and ends at the next `@@` or the end of the line. A note
starting with `claude:` is one of your earlier replies; leave it unless Calvin
has answered it.

## Work through them in order

Decide the edit level for each one (see "Three levels of edit" in `docs/writing.md`):

- **Mechanical or line edit** (eg "better word", "not a fan of this phrasing",
  "clunky", "typo?"): make the smallest edit that fixes it, keep his voice, and
  delete the note. For a word choice, use the best option and give one or two
  others in your reply
- **A question you can answer** (eg "should a figure go here?", "is this
  accurate?", "too long?"): replace the note with a short reply at the same spot,
  `@@ claude: <answer in one line> @@`, so he reads it in context in the preview.
  Don't build the figure or make the change unless the note asks for it
- **Substance** (eg "need a better ending", "this argument feels weak"):
  replace the note with a reply giving a direction and, at most, one labelled
  example line. He writes it

Never leave a note half-handled. Each one ends up deleted (done) or turned into
a `claude:` reply (waiting on him).

## Report

A checklist in chat, one line per note, in the order they appear:

- `[x] line 42 "better word": "bridges" → "connects" (also: "links", "joins")`
- `[ ] line 57 "figure here?": replied in the post, waiting on you`

Then run `python3 scripts/lint_post.py <path>`. Its warnings list the replies
still in the post, which Calvin deletes once he has read them.
