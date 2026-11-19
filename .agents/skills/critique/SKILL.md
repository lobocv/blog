---
name: critique
description: Critique the active post without editing its prose. Modes are structure (order, focus, length, what to cut), line (clarity, wording, AI tells) and audience. Use when Calvin says /critique or asks for feedback on a draft.
argument-hint: "[structure|line|audience]"
---

# Critique the active post

Find the active post and read its brief (see "Where things live" in `AGENTS.md`).
Follow the Critique protocol in `AGENTS.md`. Also read `writing/feedback.md` and
call out any recurring pattern that shows up again.

Run `python3 scripts/lint_post.py <path>` first and use its output (length, em-dashes,
banned words) instead of counting by hand.

Default mode is `structure` if the draft has never had a structure pass, else ask.

## structure

Do this before line edits, so Calvin doesn't polish paragraphs that get cut.

- Does the opening get to the point fast? Is the thesis clear by the end of it?
- Does every section serve the thesis in the brief? Name the ones that don't
- Is the order right? Does each section set up the next?
- Length against the budget. If over, rank whole cuts by how little the thesis loses
- Anything missing that the reader needs to follow the argument (only things
  the thesis depends on, not nice-to-haves)

## line

- Unclear sentences, buried points, repetition, filler
- AI tells from "Sounding human, not AI" in `AGENTS.md`
- Places where a concrete story or number would beat an abstract claim
- Leave his informal voice alone. Plain is the goal

## audience

Read as the reader in the brief:

- Terms used before they're explained, or that this reader wouldn't know
- Explanations this reader doesn't need
- Examples that don't look like problems this reader has

## Output

- Top 3 to 5 issues first, each with: quoted original, the problem, why it
  matters (name the principle), a direction to fix it. No rewrites unless asked
- Then a short list of minor or mechanical fixes. Offer to apply only the
  mechanical ones (typos, broken markdown, dead links)
- End by asking whether any pattern here should go in `writing/feedback.md`.
  Add it only if Calvin agrees
