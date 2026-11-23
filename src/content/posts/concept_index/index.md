---
title: "Communicating Effectively With Agents"
summary: "Bridging prompts and code with a topic graph."
draft: true
date: 2026-11-21
categories: ["AI", "Architecture"]
---

This is the first post in a series on agentic harness development where I share my approach to sustainable agentic development that doesn't compromise speed for quality and leaves you in complete control over your codebase. 

Regardless how you feel about it, software engineering has shifted to communicating with agents while they do the heavy lifting of researching, planning, debugging and implementing the software. Weeks of work can now be done in a matter of minutes but many developers are reporting that they're feeling even more exhausted than before because their energy is being spent deconstructing, correcting and reasoning through someone else's thought process rather than their own. I've felt this exhaustion myself, and while AI development is here to stay, there are a few ways we can reduce friction and make it less taxing on our mental health and also get better results in the process. 

The development community has come up with skills that change how agents communicate (eg [Simple English](https://github.com/AminBlg/SimpleEnglish), [Caveman](https://github.com/JuliusBrussee/caveman) and [Humanizer](https://github.com/blader/humanizer)).

But communicating effectively with agents is more than changing how they respond. It means understanding the whole engineering life cycle and the wider context agents work in: the architecture, tech debt, terminology, user experience and product vision. These are often hand-waved while a disproportionate amount of effort goes into getting agents to generate "better" code. They're essential to building a product that people actually want to use and that survives in the long term.



### The challenge of maintaining system understanding

Back in the time when developers wrote code by hand, it was fathomable that someone could think about a change to the system in terms of what services, classes, functions, files and database schemas needed changing. Even then, spending years ramping up employees, only to have them leave is not a viable long-term strategy. Agents today are a new hire that onboards instantly the moment you start a session. What's worse is that they won't tell you when they are confused and will often find localized solutions to deep rooted problems. They, just as much as any developer, need a holistic understanding of the system and cannot rely on tribal knowledge.

Organizations mitigate this (in reality, not nearly enough) by writing documentation, but the first rule of writing documentation is that it is almost immediately out of date. It also creates a second source of truth that lives separately and can contradict the code. I've thought a lot about how to write documentation in a way that ages well, but like all battles with time, you end up losing. The only viable path is to keep your documentation up to date as the system changes, but this takes a level of discipline and commitment that most organizations do not have appetite for. 

Some organizations have the philosophy that the "code is documentation" but I've never seen that as a realistic alternative to writing prose. Code can tell you what something does but it doesn't explain the intent behind it. The strategy's success relies heavily on a high quality codebase that has well-defined architecture, precise naming and cohesive code with loose coupling. Even in a highly regimented codebase, concepts will touch several files from the front end all the way down to the database.

What we need is a strategy that meets the reality of the situation: we often work in messy, imperfect systems. We need to understand both how it currently works, as well as how it is intended to work. It needs to be comprehensive, accurate and navigable without relying on the imperfect system it is describing. 

Topic graphs are a way to map concepts in natural language to their implementation in the code and filesystem. They provide a more natural index into the code than `grep`, `rg` and `glob` tooling can provide. Furthermore, they offer a way to translate from domain language to code without putting constraints on how that code is structured, organized or represented on the file system. By using agents to build and maintain the topic graph, we can keep an up to date understanding of the codebase that explains it in product terms we are familiar with, while still holding references to the implementation details that underpin them.


### A map from concepts to code

A topic graph is an index of domain concepts to the underlying resources (often files) that support them. A single topic can link to many files in different directories. Conversely, a single file can link to multiple topics. Generalizing beyond just files, resources can come from sources such as HTML pages, database schemas, or apps such as Notion and Obsidian. 

`add diagram for sources <-> resources as well as topics to resources`

The graph data structure allows us to link related topics using reference edges that contain context on the relationship. Topics naturally start to form distinct trees of concepts with root topics being broad domain areas of the product, breaking down into more granular sub-domains. Each topic can contain a reference to any other topic in the graph, carrying the reason and direction of that relationship.

The topic graph becomes the foundation on which many agentic workflows can be built:

1. Documentation generation: The root topics from the graph, along with all their children form a comprehensive map of domains within the product. They are used to generate comprehensive markdown explanations that act as materialized views for agents and humans working in the codebase. Explanations are always generated from the graph and never edited by hand.

2. Depth curation: Agents update the graph with each committed change. The changed files are mapped to topics and their explanations are regenerated. New files are attached to their relevant topic and deleted files are removed from the graph.

3. Breadth curation: Periodic passes across all root topics judge whether topics are still self-contained and cohesive. If not, agents split, rename or merge topics. 

4. Codebase curation: Agents and humans look for ambiguity, inconsistencies and gaps in the graph, then fix them in the source files. Once the fixes are merged, the graph is regenerated, and over time the codebase improves. The graph relies on nothing but the sources it indexes, so it can be deleted and regenerated from scratch at any time. Unlike documentation, it never becomes a second source of truth.

<!-- bridge from intro: part of the exhaustion is translation; humans prompt in concepts, agents search in files; grep/glob only works when names match the prompt's words -->
<!-- index from domain words to where the code lives, part of the agent's instructions; kept up to date by agents -->
<!-- how it maps to files, high level only: concepts point to files; one concept touches many files, one file many concepts; folders don't move. Diagram candidate (/diagram) -->
<!-- optional one-line example: vesting logic spread across packages. Keep it to a line, the architecture story is the project page -->
<!-- mention, don't explain: high cohesion, layered architecture, DDD as the industry's answer to the same problem -->
<!-- plan in concepts first: agree earlier, without getting stuck on code details -->
<!-- one line: this is where Trellis started (no pitch); what it is, not how it works (next post) -->

### 


<!-- (~300) one term, one concept; DDD's ubiquitous language (named, not explained) -->
<!-- one short general example of an ambiguous term (two meanings for one word, or two words for one thing) -->
<!-- optional: one line linking the follow-up post on how the topic graph works -->
