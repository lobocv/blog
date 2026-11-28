---
date: 2026-11-27
kind: architecture
---
# Short links are pages on the site itself

Decision record: explains why, as of its date. Code is authoritative for present behavior.

## Context

The share page puts a link to the post in each social post. Some networks show
the URL and count it against the post's length (Bluesky most of all), so a long
tagged URL (`.../posts/<slug>/?utm_source=bluesky&utm_medium=social`) costs
space and looks noisy. A short link fixes that, but it has to keep the utm tags,
so analytics can still tell where readers came from.

The site is static, on GitHub Pages: there's no server to answer a short URL
with a real redirect (an HTTP 301).

## Decision

- Short links live on the site: `https://www.lobocv.com/s/<code>/`, with a random
  six-character code from an alphabet without look-alikes (no 0/o, 1/l/i).
- Each code maps to its post and the tagged path it sends readers to, in
  `src/data/short-links.json`. The editor's share page adds a code the first time
  a network's post uses a short link, and reuses it after that.
- The build writes a page per code (`src/pages/s/[code].astro`) that redirects with
  a `<meta http-equiv="refresh">` and a one-line script as backup.
- That page copies the post's title, summary and preview image into its own OG
  tags, so the link card matches the post's.
- The build fails, saying what to fix, when a code points at a post that's gone
  or unpublished. Short link pages are kept out of the sitemap.
- Pre-flight on the share page checks each short link's page is live and goes
  where it should, since a new code only works once the site is deployed.

## Why

The strongest argument is that links stay on Calvin's domain, with nothing
between a reader and the post that we don't control. A third-party shortener can
change its terms, add its own tracking, or shut down, and every link posted
through it goes with it.

Beyond that:

- No account, API key or second service to keep working.
- A destination can be fixed after posting (eg a wrong utm tag) by editing one
  line in the data file and deploying.
- The page's own OG tags matter: LinkedIn, X and Bluesky build the link card by
  fetching the URL, and may not follow a meta refresh. Astro's built-in
  `redirects` pages carry no OG tags, so we use our own template rather than
  those.

The cost is that a short link works only after a deploy, which the editor never
does itself. Pre-flight makes that visible instead of leaving it to be found
after posting.

## Rejected options

- A third-party shortener (eg Bitly). An external dependency for every posted
  link, and analytics split across two places.
- Astro's `redirects` option, which already makes the category redirects. Its
  pages carry no OG tags, so a short link would lose its card.
- Short links only from LinkedIn and X's own shorteners. They wrap links anyway,
  but not every network does, and the URL people see would still be ours.
- Codes made from the post's slug. Readable, but long, and they'd collide when a
  post gets a second link for another network.
