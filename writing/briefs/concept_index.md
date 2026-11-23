# Communicating Effectively With Agents

First post in the Trellis series. Opens the series broadly (agent work is exhausting because the full product engineering context isn't accounted for), then focuses on one part of that: communication, through the topic graph.

- Thesis: Agent development is more exhausting than it should be because communicating with agents is treated as changing their response style (eg Plain English, Caveman, Humanizer). Communicating effectively means understanding the whole engineering life cycle and the wider context agents work in (architecture, tech debt, terminology, UX, product vision and strategy). Communication is one part of that, and this post covers one aspect of it: humans prompt in concepts, agents search in files. Grep and glob only bridge the two when the codebase's naming is consistent, so agents need an index from concept (the language humans prompt in) to the code that implements it.
- Reader: working software engineers who use AI coding tools (default reader). Comfortable with Go and architecture
- Takeaway: your agent instructions should include an index that maps natural language (domain concepts) to the code where it lives, kept up to date. The index only works if the names in it mean one thing (consistent, unambiguous language, the core premise of DDD)
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
