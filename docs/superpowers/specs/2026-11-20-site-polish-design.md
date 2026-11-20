# Site polish: reading features, side foliage and home sections

Short design. Approved in conversation on 2026-11-20 ("yes let's do all those suggestions").

## Intent

The Astro site is live. This pass makes posts nicer to read and share, and reshapes the home page around how Calvin approaches engineering. A resume section comes later.

## What we build

### Posts

- Code blocks
  - Tabs render 4 wide (Go uses tabs, so nested code was pushed off to the right)
  - Optional filename label via fence meta (eg ```` ```go title="main.go" ````), shown instead of the language label
  - Line highlighting via fence meta (eg `{3,5-7}`) or a `// [!code highlight]` comment
  - A header strip for the label and Copy button, and a fade on the right edge while a line is scrolled off
- Tables: grid lines, header row, alternating row tint, tabular numbers, horizontal scroll on phones
- Captions: a bold paragraph starting `Figure N:` or `Table N:` becomes a real `<figcaption>` under the image or table it follows. A bold `Table: name` line directly above a table becomes the table's `<caption>`. Posts keep using the convention AGENTS.md already describes.
- Footnotes
  - The two posts with hand-written `[1]` notes move to Markdown footnote syntax (`[^1]`). This is a mechanical edit: prose is unchanged.
  - Notes link both ways, and on devices with a mouse, hovering or focusing a marker shows the note in a popover. Touch devices keep the jump link.
- Heading links: a `#` appears on hover beside h2 and h3, linking to that section
- Images open full screen in a `<dialog>` when clicked

### All pages

- The faint side foliage from the home page runs down the margins of every page, regenerated when the page height changes
- Social preview images: one PNG per post plus one for the site, built with `satori` and `@resvg/resvg-js`. The night horizon art sits behind the title. Pages get Open Graph and Twitter card tags.

### Home page

- Order: hero, then "How I approach engineering", then About me, then the existing writing sections
- Philosophy is a list of "X over Y" principles. Calvin's resume lines go in as placeholder text, in `src/data/philosophy.ts`, for him to rewrite
- About me is the photo, a placeholder paragraph, links, and "More about me" to `/about/`
- The author card moves out of the lower Topics row into the About section, so it isn't shown twice

## Approaches considered

- Footnotes: auto-linking the existing `[1]` text with a plugin keeps the posts untouched but bakes a non-standard convention into the build. Moving to `[^1]` uses what the Markdown parser already supports, and new posts get it for free. We picked `[^1]`.
- Captions: wrapping images in `<figure>` by hand in each post would need prose-file edits for every figure. A rehype plugin keyed on the existing bold caption convention needs none. We picked the plugin.
- Social images: a hand-made static image per post doesn't scale; a headless browser at build time is heavy in CI. `satori` renders at build in plain Node. We picked `satori`.

## Not in scope

- Resume section (next)
- Writing the philosophy and about copy (Calvin writes it)
