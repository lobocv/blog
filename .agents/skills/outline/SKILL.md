---
name: outline
description: Propose the section order for the active post as terse bullet fragments, then write it into the post as headings and fragments for Calvin to write over. Use when Calvin says /outline or asks how to structure or order a post.
---

# Outline the active post

Find the active post and read its brief (see "Where things live" in `docs/writing.md`).
If there is no brief, suggest `/scope` first.

- Propose 3 to 6 sections. For each: a heading option and 1 to 3 bullet
  fragments of what it covers (eg "grep finds files, not relationships")
- Fragments, never sentences Calvin could paste into the post
- Explain in one line each why this order works (eg "problem first so the
  reader feels the pain before the fix")
- Check every section against the thesis. If one doesn't serve it, leave it out
  and say so
- Offer at most one alternative order, and only if it is genuinely different
- Estimate words per section so the total fits the budget in the brief

Wait for Calvin to approve or rearrange. Then write the approved outline into
`index.md` below the front matter: `###` headings with the fragments as an HTML
comment under each, so they don't render if forgotten:

```markdown
### Why grep isn't enough

<!-- grep finds files, not relationships; agent re-reads the same 20 files -->
```

Then step back. Drafting is Calvin's.
