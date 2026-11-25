# Communicating Effectively With Agents

First post in the Trellis series. Published 2026-11-24.

A direction, not a contract. `/rescope` updates it when the post changes shape.

- Thesis: Working with agents is exhausting partly because humans think in concepts and agents think in files, classes and functions. Documentation can't bridge the two because it goes stale and becomes a second source of truth. A topic graph, built and kept current by agents, maps domain concepts to the code (and other sources) behind them, and it only works when each word means one thing.
- Reader: working software engineers who use AI coding tools (default reader). Comfortable with Go and architecture
- Takeaway: Words in a system should have a single meaning. A topic graph maps concepts to code and shows where language is ambiguous (eg "grant" under both equity and access topics), so it can be fixed.
- Framing: general and industry-wide, not tied to one job. Calvin felt it at work and on personal projects, and readers will recognize it without much proof. No Pulley section. At most a one-line example (eg vesting logic spread across packages)
- Supporting points:
  - The mismatch between how humans communicate (natural language, intent, problems) and how agents search (files, structs, names)
  - Examples of how it goes wrong
  - Mention (don't explain) that consistent language, high cohesion and layered architecture help. Naming industry-known ideas (Clean, hexagonal and layered architecture, DDD, low coupling and high cohesion) shows the problem is real and recognized. The reader is senior enough to know them
  - Clarify what "names mean one thing" means
- Terminology: say "topic graph" (Calvin's choice, 2026-11-22), not "concept map" or "knowledge graph". Use it across the series
- Out of scope:
  - Pulley and specific experiences (project page, link to it once written)
  - Deep internals of the topic graph (follow-up post or project page). In scope here, by Calvin's choice: what the graph looks like (topics link to resources many-to-many, sources beyond files, topics form trees and reference each other) and the four workflows (explanations, depth curation, breadth curation, codebase curation), because they show how the graph becomes something a human or agent can use and stays current
  - The full DDD argument for consistent language (separate `[trellis]` idea)
  - The layoff
  - Other parts of communication (eg progressive disclosure, generative UI), a separate series
  - Trellis as a product (no pitch, no access)
- Budget: 1,200 to 1,800 words

## Title

- Title: Communicating Effectively With Agents
- Summary (shown as the lede under the title): Bridging prompts and code with a topic graph.

## Changes

- 2026-11-24, thesis: was framed against "response style" tools (Plain English, Caveman, Humanizer) and opened broad (the whole engineering life cycle) before narrowing. Now opens on the language gap (concepts vs files) and keeps the whole-system view as one paragraph. Why: the response-style framing was dropped while drafting the intro; not discussed further
- 2026-11-24, new section: why documentation fails (goes stale, second source of truth, agents can't find what to update), with its own figure. Why: it sets up why an index has to be derived rather than hand-written
- 2026-11-24, workflows: the four named workflows (explanations, depth, breadth and codebase curation) became one curation loop with no depth/breadth split. Why: Calvin found the split confusing and too detailed
- 2026-11-24, takeaway: "put a concept-to-code index in your agent instructions" no longer appears; the post ends on "one word, one meaning". Why: not discussed. A candidate for the follow-up post on how the graph works
- 2026-11-24, scope: topic trees and labelled references between topics got their own figure; the DDD mention moved into the intro as "Ubiquitous Language"
