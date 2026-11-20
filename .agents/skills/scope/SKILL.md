---
name: scope
description: Start a new post. Interview Calvin to pin down the thesis, reader, takeaway and what is out of scope, then create the draft post and its brief. Use when Calvin says /scope or wants to start writing a post.
argument-hint: "[idea or slug]"
---

# Scope a post

Read `AGENTS.md` (Workflow, Audience, Series) and `writing/ideas.md` first.

## Interview

Ask questions one or two at a time. Calvin answers in his words. You push back,
you don't answer for him.

1. If no idea was given, show the ideas list and ask which one
2. What happened that made this worth writing about? (the real story behind it)
3. Thesis: what does the post argue or show, in one sentence?
   - Push back if it needs "and". That is usually two posts
   - Push back if it is a topic ("knowledge graphs") instead of a claim
4. Reader: who is it for and what do they already know?
5. Takeaway: what can the reader do or think afterwards that they couldn't before?
6. Out of scope: what is tempting to include but doesn't serve the thesis?
   Offer to park those in `writing/ideas.md`

Stop when all five are answered. Don't draft any prose for the post.

## Create the files

- Pick a short snake_case slug (eg `topic_anchors`) and confirm it
- `writing/briefs/<slug>.md`, using Calvin's own words from the interview:

  ```markdown
  # <working title>

  - Thesis:
  - Reader:
  - Takeaway:
  - Out of scope:
  - Budget: 1,200 to 1,800 words
  ```

- `src/content/posts/<slug>/index.md` with only front matter, `draft: true` and
  today's date. Published posts also need a one-line `summary` (shown on cards and in RSS), added before shipping. Title options go in the brief, not the post
- Move the idea out of `writing/ideas.md` if it came from there

Then say the next step is `/outline`.
