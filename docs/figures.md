# Figures: design language

How figures in posts and project pages look and behave. Read this before building
or changing one (`/diagram` does). Every rule here came from a correction Calvin
made while writing a post, so following them saves a round of feedback.

The reference implementations are the figures in `src/components/post/`,
used by `communicating_effectively_with_agents`.

## What a figure is for

- **One idea per figure.** If a figure needs two kinds of mark (eg topic-to-file
  links and topic-to-topic references), it is probably two figures, or one of
  the ideas belongs in the prose
- **It replaces a paragraph; it doesn't repeat one.** Don't add a figure that
  shows what the surrounding prose already says plainly
- **No caption that repeats what the figure shows.** No "An illustration" or "Tap
  a layer to…" lines. If an explanation is needed, put it in an `InfoTip`. If
  colours need a key, add a `Legend`
- **Use examples any engineer knows.** The reader shouldn't need domain
  knowledge (eg equity vesting) to read the figure. Keep one running example
  across a post's figures when it fits
- **Use the post's own words** for every label. Nothing the text doesn't explain
- **Build figures after the structure has settled** (see the Workflow in
  `docs/writing.md`). A placeholder note is fine while drafting

## Interaction and motion

- **Readers set the pace.** Use previous/next buttons and step dots for a
  sequence, or play once when scrolled into view and offer a `ReplayButton`. No
  long scripted scenes, and nothing that makes the reader wait to see the content
- A loop is fine for a short comparison (eg file search vs the graph), as long as
  it holds the end state for several seconds and pauses off screen
- Animations stay short: about 0.3 to 0.7s per step
- With `prefers-reduced-motion`, or without JS, show the final state
- Hover detail must also work by tap and keyboard (`InfoTip` does both)

## Colour

Use the roles, not raw tokens. `Figure` defines them, and they follow day and night:

| Role | Variable | Means |
|---|---|---|
| good | `--fig-good` (and `--fig-good-soft` for fills) | found, correct, current, the thing to look at |
| miss | `--fig-miss` | missed, wrong, outdated |
| ref | `--fig-ref` | a reference between things, or off target |
| muted | `--fig-muted` | structure: guide lines, tree lines, secondary labels |

A colour means the same thing in every figure of a post. Don't use colour for
decoration.

## Type and shapes

- Labels, file names, topics and code: JetBrains Mono, 11 to 14px
- Sentences inside a figure (tooltips, step captions): the body font, 13.5 to 15px
- Chips (`.fig-chip`): small rounded boxes for topics, files and terms. `.lit`
  for highlighted ones
- Small uppercase mono labels for kinds (eg `CURATE`, `PROMPT`), in the role colour
- Rounded corners: 14px for the frame, 8 to 10px for panels, 6 to 7px for chips

## Layout

- Design the phone layout; don't just shrink the desktop one. Stack columns,
  move side-by-side panels above the content, and run connecting lines down an
  edge
- No horizontal scrolling at 390px wide
- Use `minmax(0, 1fr)` grid columns so long names can't push a column wider
- Controls sit with the figure: the replay button top right, previous/next beside
  the diagram on wide screens and beside the step dots on phones

## Shared components (`src/components/figure/`)

| Component | Use |
|---|---|
| `Figure` | The frame every figure sits in. Pass your own `class` for scoped styles, and `label` when the figure is one picture (it becomes `role="img"`) |
| `ReplayButton` | Circular arrow in the top-right corner. Listen for clicks on `.fig-replay` |
| `InfoTip` | A `?` button with a short explanation in its slot. Put it in a header with `position: relative` |
| `Legend` | A colour key: `items={[{ label, color: 'good' }]}`, `bar` for line or block marks |

Styles live in `src/styles/figure.css` (`.fig`, `.fig-chip`, `.fig-replay`,
`.fig-info`, `.fig-pop`, `.fig-legend`). Elements rendered by a shared component
don't carry your component's scope, so style them with `:global(.fig-pop)` and
the like.

## Before calling a figure done

- Screenshots at 1280 and 390 wide, in day and night (`?time=day`)
- Animations recorded or stepped through, not judged from one screenshot
- `npx astro check` passes
- Alt text or `label` describes what the figure shows
