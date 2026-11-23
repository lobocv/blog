# Timeline page design

## Intent

A single page that tells Calvin's story as a developer and as a person, for hiring managers, recruiters and potential partners. It covers work history, projects, life commentary that isn't on the resume (eg liking science but really wanting to build, with no engineering classes and little career guidance) and things that show character (renovations, hobbies).

It should be beautiful, animated and tied to the site's theme: a faceted wolf, in the same style as the home hero, runs through a landscape that changes with each chapter and grows older as the story goes on.

Reading is the point. The whole story arrives by scrolling. Interaction is optional and light.

## Goals

- A long scroll page, linked from the nav
- A pinned scene at the top (about a third of the screen) with a normal text column below it. The scene follows whichever entry is being read
- The wolf runs while the reader scrolls and stops when they stop. Scrolling up rewinds the scene (wolf keeps facing right, run cycle plays backwards)
- The wolf ages through four stages: pup, yearling, adult, grey muzzle
- Each chapter has its own scene, drawn from the work itself (see Scenes)
- Room for two or three short paragraphs plus a few bullets per chapter
- Things that ran in parallel (renovations, hobbies, side projects) shown lightly beside the chapter they overlapped, one line each, expandable for more
- The story ends at the home hero's view: the wolf on the rock over the valley

## Non-goals

- A downloadable resume or contact form
- Linking every journal entry. Chapters link to project pages (eg Avalanche) where one exists
- Editing tools for the content. It is a data file

## Anti-goals

- Making readers click to learn the story (scene hotspots, hidden cards)
- Text drawn over the art, or art that makes text hard to read
- Heavy scroll-jacking (snapping, forced pauses)
- Sensitive details: phone number, email, coworker names, internal disagreements (eg why Calvin left Infisical), customer names, business numbers
- Decorative art that doesn't relate to the chapter

## Constraints

- Astro static site, vanilla TypeScript, no UI framework (matches the site)
- Colours from the tokens in `src/styles/site.css` so day/night works
- Must work on a phone and honour `prefers-reduced-motion` (static scene per chapter, no running)
- The text column is plain HTML, so the page reads fine without the scene (search, copy, print, screen readers)
- Performance in line with the hero: pre-baked layers, animate transforms and opacity only

## Approaches

We considered three layouts:

- Scene on top, story underneath (chosen). The scene is pinned and moves with reading; text scrolls normally. Readers go at their own pace and the text is never covered. The art is more of a backdrop than the star
- Full-screen scene with captions that fade in. Most cinematic, but captions are only visible for a moment, so skimmers miss things. Cramped on phones and the hardest to tune
- A trail down the page with entries alternating left and right. Simplest, but loses the single continuous landscape and makes the wolf decoration

Calvin picked the first because the main readers are hiring managers who skim at their own pace.

The grey-box prototype (`prototypes/timeline/greybox.html`) confirmed the layout and the scroll feel.

## Content model

- Chapters are the main entries and never overlap. Kinds: `work` and `life`
  - Life chapters are Calvin's own commentary (high school, physics to software, what's next)
  - Work chapters: title, dates, a few paragraphs, a few bullets, optional link to a project page
- Side items: `renovation`, `hobby`, `project`, with dates. Each attaches to the chapter its start date falls in, and shows a one-line summary that expands with `<details>`
- Each chapter names its scene and wolf age
- In the scene, chapter props sit on the trail. Side item props sit in the background layer so the wolf passes them without stopping

### Chapters and dates

| When | Chapter | Scene | Wolf |
|---|---|---|---|
| ~2004–2008 | High school (life) | Fork in the trail: science / build, fog over the build path | pup |
| 2008–2013 | McMaster, Honours BSc Physics (co-op) | Night sky, constellations | pup |
| 2013 | Physics to software (life) | Night sky | yearling |
| Jul 2013 – Nov 2017 | Sensors & Software | Ground cutaway with radar pulses | yearling |
| Nov 2017 – Nov 2018 | Patriot One | Radar sweep | adult |
| Nov 2018 – Dec 2019 | Stratoscale | Low clouds in the valley | adult |
| Feb 2020 – 2024 | Hootsuite, Social Analytics | Snowy pass, avalanche | adult |
| 2024 – Aug 2025 | Hootsuite, Architecture | Summit view | grey muzzle |
| Sep 2025 – Aug 2026 | Pulley | Ridge climb | grey muzzle |
| Aug 2026 – Oct 2026 | Infisical | Ridge climb | grey muzzle |
| Now | What's next (life) | The rock over the valley (home hero) | grey muzzle |

Side items known so far: Trellis (2025 to now, beside Pulley). Renovations and hobbies are still to come from Calvin.

## Decided by Claude (Calvin to check)

- URL `/journey/`, with a nav link. "Timeline" is the fallback name
- Content lives in one data file (eg `src/data/timeline.ts`) with Markdown strings for paragraphs, so adding an entry is a data change
- Writing follows the project-pages rule: Claude drafts the work chapters from the resume and work journal facts in Calvin's voice, and Calvin reviews them. Life chapters and side items are Calvin's words
- Art style matches the hero: faceted shapes, the same token palette, the same layered motion
- The wolf is four static faceted drawings (one per age) with simple leg movement and a cross-fade between ages. No frame-by-frame animation
- Order of work: one scene at full quality first (Sensors & Software radar) to lock the style, then the rest

## Left to the builder

- How each scene is composed and when its props appear
- The exact mapping from scroll position to camera position
- How the phone layout crops the scene
