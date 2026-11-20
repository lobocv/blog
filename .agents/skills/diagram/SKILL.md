---
name: diagram
description: Build a diagram for the active post and insert it at the most logical spot in the post. Use when Calvin says /diagram or asks for a diagram, figure or visual of a concept.
argument-hint: "<what the diagram should show>"
---

# Diagram for the active post

Find the active post and read its brief (see "Where things live" in `AGENTS.md`).

## Decide whether it earns its place

A diagram should replace or clarify a paragraph, not repeat it. If the thing
asked for is better as a table, a code snippet or a sentence, say so in one line
and ask before going ahead.

## Build it

- Keep it small: the fewest boxes and arrows that make the point. Readable on a phone
- Use the same names the post uses for things. No labels the text doesn't explain
- Write D2 source to `src/content/posts/<slug>/<name>.d2` (the source of truth, so it
  can be edited and re-rendered later)
- Render it if `d2` is installed:
  `d2 --theme 0 --dark-theme 200 --pad 20 <name>.d2 <name>.svg`
  (the dark theme is embedded and follows the reader's system setting)
- If `d2` isn't installed, hand-write a clean SVG instead and mention once that
  `brew install d2` enables rendering from source
- Use a short kebab-case name (eg `graph-traversal`)

## Insert it

Place it where the reader first needs it: right after the paragraph that
introduces the concept, before any text that relies on the picture. Don't put
it at the top of a section by default, and don't add prose around it.

```markdown
![<alt text describing what the diagram shows>](<name>.svg)
```

Report the line you inserted it after, in one line, so Calvin can move it.
Then run `python3 scripts/lint_post.py <path>` to confirm the image resolves.
