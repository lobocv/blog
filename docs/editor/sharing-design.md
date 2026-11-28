# Writing editor: sharing posts on social networks

A section of the editor that gets a published post ready to share: the text,
link, hashtags and image for each network, checked and ready to paste. LinkedIn
comes first. The structure makes each further network a data file and, later,
one adapter. Everything follows `architecture.md`.

## Intent

Sharing the agents post took most of a session: checking the live page,
building tagged links, critiquing a draft, rewriting it, rendering a figure as
an image, sizing it, choosing hashtags, and learning each network's quirks along
the way. Most of that is the same for every post and can be automated. The parts
that need judgment (the hook, the voice) are where Claude helps and Calvin
decides.

- Phase 1: the editor produces files Calvin copies into each network's UI
- Later: the editor posts through each network's API

## What the manual run taught us

These shaped the design, so they're worth keeping in one place:

- A network shows either an image or a link card, not both (LinkedIn, Bluesky).
  The URL still works as plain text next to an image. So each network needs a
  media mode, not just "attach an image"
- LinkedIn hides everything after roughly the first two lines behind "…see
  more". The hook has to land before that fold
- Networks count links differently: X counts any URL as 23 characters, and we
  weren't sure how Bluesky counts them. Length checks need per-network rules
- UTM tags already work: Google Analytics 4 is on the site (`src/layouts/Base.astro`),
  so `utm_source=<network>&utm_medium=social` shows up under Traffic acquisition.
  The share buttons use `utm_medium=share`, so reader shares stay separate
- Figures make better images than the generic preview card, but a screenshot
  needs cleaning up: hide the info buttons and side foliage, wait for the
  animation to finish, and use the day theme (it stands out in a mostly white
  feed)
- Hashtags are a light signal now (LinkedIn dropped hashtag following). Three to
  five relevant ones is the common advice. Chasing trending hashtags isn't worth
  automating
- Working critique into a short post by hand was slower than reviewing a
  rewrite, so Claude writes social posts and Calvin edits them (decided
  2026-11-27, in the `/share` skill)
- Calvin's edits taught us voice rules (eg "bridge the gap" reads as AI-written,
  don't pitch Trellis). The tool should capture those, not lose them
- Claims need checking against the post. A draft said "over a year" about
  Trellis, which came from repo notes rather than the post

## Goals

- A share page per published post, with a tab per network. LinkedIn first
- Opening it for the first time does the routine work automatically: live
  checks, links, an image, hashtags and a first draft of the text
- Every rule that can be checked without judgment is checked live as Calvin
  types (length, fold, hashtag count, banned words, em-dashes)
- Output is plain files Calvin can copy from, plus copy buttons
- Each network is its own module, so each one can be tuned to how it works.
  Adding a network is a module plus, later, a publisher adapter

## Non-goals

- Posting through APIs (later, see "Posting through APIs")
- Scheduling posts
- Pulling analytics back into the editor
- Reddit, Hacker News and Changelog. They're posted by hand with clean URLs and
  no drafted text, as the `/share` skill already describes

## Anti-goals

- Posting anything without Calvin pressing the button
- Text that claims things the post (or Calvin) doesn't say
- Growth-hacking features (trending hashtag scraping, engagement bait)
- A network abstraction so general that LinkedIn's quirks get lost

## The flow

1. Calvin opens a published post's share page (S on the posts page, or ⌥S in
   the editor). Drafts can't be shared
2. Pre-flight runs: the live page loads, the OG tags are present, the preview
   image loads, and every short link resolves. The results are for
   information only and never block anything
3. On first open, the editor fills in each enabled network:
   - the link, tagged or short as the network's default says
   - an image: Claude picks the figure that best shows the post's argument, and
     the editor renders it at the network's size, with alt text
   - hashtags, from the post's categories and a hand-kept map, within the
     network's limit
   - the text: Claude writes it from the post, the brief and `docs/voice.md`.
     If Calvin pastes his own draft first, Claude critiques it and rewrites it,
     keeping his phrasing where it works
4. Calvin edits the text in place. The checks update as he types. He can ask
   Claude for changes in the share page's thread (eg "shorter hook", "drop the
   Trellis line")
5. Copy text, save image, open the network's compose page. After posting,
   Calvin pastes the post's URL and the network is marked posted

## Networks

Networks differ in more than numbers: where the fold falls, how links count,
what media a post can carry, how the text is put together, and how a post looks
in the feed. So each network is a module that owns its behaviour, not just a
row of settings.

The rule: shared code never branches on which network it has. No `switch` on a
network id, no `if (network.id === 'linkedin')`, no lookup tables keyed by
network outside the network's own folder. When a network needs to behave
differently, the difference becomes a method or field on the `Network`
interface, and every network implements it. `editor/architecture.test.ts`
enforces this:

- only the registry imports network modules
- outside the network folders, the registry and the preview components, no
  code compares a network id or names a specific network

```ts
interface Network {
  id: string;                        // 'linkedin', 'x', 'bluesky'
  label: string;
  composeUrl: string;

  // Text
  count(text: string): number;       // the network's own counting (X: any URL is 23)
  limit: number;
  fold: Fold;                        // where the feed cuts the post, if it does
  assemble(post: SocialPost): string; // text, link and hashtags in the network's order

  // Hashtags
  hashtags: { min: number; max: number; placement: 'end' | 'inline' };

  // Media: what a post can carry, and the default
  media: MediaOption[];              // eg ['image', 'link-card', 'text-only']
  defaultMedia: MediaOption;
  imageShapes: Shape[];              // eg landscape and portrait, with sizes
  defaultShape(figure: Size): Shape; // from the figure's proportions
  altText: boolean;

  // Links
  defaultLink: 'tagged' | 'short';
  utmSource: string;

  // Checks only this network needs, on top of the shared ones
  checks?: Check[];
}

type Fold =
  | { kind: 'none' }
  | { kind: 'lines'; lines: number; viewport: 'phone' };  // eg LinkedIn: about 3 lines on a phone
```

- Each network lives in `editor/domain/social/networks/<id>/`, with its own
  tests. A registry lists the enabled networks in tab order
- Its phone preview is a UI component next to the others
  (`editor/ui/share/previews/<id>.tsx`), styled like that network's feed (width,
  font, line height, where the "…see more" goes)
- The fold is measured in lines, because that's how feeds cut posts. Lines
  depend on rendering, so the phone preview measures where the cut falls and
  reports it back; the fold check ("the hook ends before the fold") uses that
- Every choice gets a per-network default (media, link, image shape), and a
  choice made on one tab doesn't carry over to another
- Numbers (limits, fold lines, image sizes) get checked against each network's
  own docs when its module is written, not taken from memory

LinkedIn's starting point: about 3,000 characters, a fold at about 3 lines on a
phone, three to five hashtags at the end, image by default, both landscape and
portrait, alt text, and the tagged link inline (LinkedIn wraps links in its own
shortener anyway).

## Architecture

New code follows the existing layers. Nothing here changes the import rules.

```
editor/
  domain/social/
    networks/linkedin/     the LinkedIn module and its tests. x/ and bluesky/ later
    networks/registry.ts   the enabled networks, in tab order
    social-post.ts         a network's post: text, hashtags, link, image, alt text,
                           status (draft, ready, posted) and its versions
    checks.ts              length (with the network's counting), fold, hashtag
                           count, banned words and em-dashes. Runs in the browser
    links.ts               tagged URLs and short-link codes
    hashtags.ts            categories to candidate hashtags, trimmed to the limit
  app/
    open-share.ts          loads or creates a post's share state, runs pre-flight
    draft-social-post.ts   asks Claude for text, hashtags, figure and alt text
    render-share-image.ts  renders the chosen figure or image for a network
    mark-posted.ts         records the posted URL and time
  infra/
    fs-share-store.ts      writing/share/<slug>/ (see "Files")
    live-checker.ts        pre-flight: the live page, its OG tags and preview image
    figure-renderer.ts     headless Chromium (Playwright's, which the end-to-end
                           tests already install) against the preview server's
                           one-figure page: hide its chrome, pad to the network's size
    mcp-tools.ts           adds write_social_post (below)
  ui/views/ShareView.tsx   /?share=<slug>
```

New ports in `app/ports.ts`, each with a fake and a contract suite:

- `ShareStore`: load and save a post's share state and its rendered files
- `LiveChecker`: pre-flight against the deployed site
- `ImageRenderer`: render a figure component or image to a PNG at a given size
  and theme
- `Publisher` (later): post to a network. Phase 1 has no implementation; copying
  is done in the UI

### How Claude takes part

- Social posts are Claude's to write, unlike blog posts. So instead of
  `suggest_edit`, Claude calls a new tool, `write_social_post(network, text,
  hashtags, figure, alt)`, which saves a new version straight away. Calvin's
  edits are versions too, so nothing is lost and either can be restored
- The share page has its own Claude session per post, separate from the
  writing session, so share talk doesn't fill up the post's conversation. Its
  first message carries the post, the brief, `docs/voice.md` and the network's
  rules
- Claude must flag any claim that isn't in the post or brief (eg how long
  Trellis has existed) rather than state it
- When Calvin rewrites part of Claude's text, Claude asks once whether the
  change is a voice rule worth adding to `docs/voice.md` (eg "bridge the gap").
  Calvin decides; nothing is added on its own

### Images

- Media is one choice per tab, from the network's own options (eg image, link
  card, text only). The image picker shows only when Image is chosen, so there
  is no separate "no image" entry
- The picker lists the post's figures (MDX components and images, found the
  way `domain/figure.ts` finds them today) and the post's preview image
- Rendering reuses the preview server's one-figure page (`/_editor/figure`, the
  same page Source shows figures from): lay the figure out at the post's column
  width, hide `.fig-info` and `.side-foliage`, wait for its animations, then zoom
  it and pad it in the page's background colour to the network's image size
- Day theme by default, night as an option
- Landscape and portrait are both supported, since the right shape depends on
  the figure (a wide diagram reads better landscape, a tall tree portrait).
  Claude suggests one from the figure's proportions; Calvin can switch
- Alt text describes what the figure shows. Claude writes it; Calvin can edit it

### Links

- Tagged: `<post URL>?utm_source=<network.utmSource>&utm_medium=social`
- Short links are first-party: `https://www.lobocv.com/s/<code>`, with a random
  code (eg `k3x9q2`) that points at one network's tagged URL. The codes live in
  a data file (`src/data/short-links.json`, JSON so the editor can write it
  safely) the editor writes to
- Why first-party: no third-party account or API, links stay on Calvin's domain,
  and a destination can be fixed after posting (eg a wrong tag) by editing the
  data file
- GitHub Pages only serves static files, so there is no server to answer with
  a real redirect (an HTTP 301). Instead the build writes a small HTML page at
  `/s/<code>/index.html` that sends the browser on as soon as it loads, with a
  `<meta http-equiv="refresh">` tag and a one-line script as backup. Astro's
  `redirects` option already makes pages like this for the category redirects
  (`src/lib/redirects.mjs`)
- A plain redirect page has one catch: LinkedIn, X and Bluesky build the link
  card by fetching the URL and reading its OG tags, and they may not follow a
  meta refresh. So we don't use Astro's built-in redirect pages here. Each
  short link page is our own template (`src/pages/s/[code].astro`) that copies
  the post's title, summary and preview image into its OG tags before
  redirecting, so the card looks the same as the post's own
- The short link only works once the site is deployed. The editor never commits
  (see `architecture.md`), so pre-flight shows whether each short link
  resolves yet
- LinkedIn and X wrap links in their own shorteners anyway, so their default
  is the tagged link. It matters most where the URL is shown and counted,
  like Bluesky

## Files

`writing/share/<slug>/`, one folder per post:

```
share.json        per network: status, versions, chosen figure and theme,
                  alt text, link, posted URL and time
linkedin.txt      ready to paste: text, link and hashtags in order
linkedin.png      the rendered image
x.txt, x.png      ... one pair per network
```

The `.txt` files are rewritten on every save, so the last version is always
ready to paste even outside the editor. The whole folder is committed,
images included, so nothing that was posted is lost (decided 2026-11-27).

## UI

Mock: https://claude.ai/artifact/JNbriQdY6PtPWk1X7KqEDe

- Top: the post's title, summary and preview card, and the pre-flight results
- One tab per enabled network. Each tab has:
  - the text, with the character count by the network's rules and a line where
    the fold falls
  - a phone preview beside the text, always on, in that network's feed style.
    Most people read on their phones, so this is how Calvin judges the hook
  - hashtags as chips (remove, add)
  - the link (the network's default, tagged or short), with copy
  - the media choice from the network's options, then the image picker with a
    preview, shape and theme toggles, and alt text
  - Copy text, Save image, Open compose page, and a field for the posted URL
  - versions in a menu by the text, each with Restore
- The share page thread on the right, like the page thread in the editor
- Keyboard first, following `architecture.md`: tabs by number, C copies the
  text, I saves the image, O opens the compose page
- Checks show only when something fails, matching the editor's "nothing that
  doesn't help" rule

## Posting through APIs (later)

Each network gets a `Publisher` adapter in `infra/` that passes a shared
contract suite. The UI gains a Post button per network, and posting is always a
button press.

- Bluesky first: the AT Protocol API is open and works with an app password,
  so it's the cheapest to prove the port
- LinkedIn: needs an app with the right scope for member posts and OAuth, plus
  an image upload step. Approval can take time, so apply early
- X: API access is a paid tier
- Credentials live in the macOS keychain, never in the repo

## Milestones

Each ends with something Calvin can use and a passing `make verify`.

1. Share page for LinkedIn without Claude or images: the network module and
   registry, the phone preview, links, pre-flight
   (ported from `scripts/share.py`), checks as you type, files on disk, copy
   buttons. Then retire `scripts/share.py` and `make share`, and point the
   `/share` skill at the share page
2. Images: figure picker, renderer, day and night, alt text by hand
3. Claude: the share session, `write_social_post`, first drafts, critique of a
   pasted draft, hashtags, alt text, and claim flagging
4. Short links: the data file, static redirects, pre-flight that they resolve
5. X and Bluesky modules and previews. No new code outside their own folders
   should be needed; if it is, the `Network` interface is wrong
6. Later: the Bluesky publisher, then LinkedIn and X

## Decided

- `writing/share/` is committed, images included (2026-11-27)
- `scripts/share.py` is retired once milestone 1 covers it. It wasn't used
- Landscape and portrait images are both supported, chosen per post
- Short-link codes are random
- Each network is a module with its own defaults (fold, media, link, image
  shape). Choices don't carry over between tabs
- The fold is measured in lines, per network, by its phone preview
- The phone preview is always on
- Pre-flight never blocks; a broken link isn't the share page's problem
- Versions sit in a menu, not always on screen
- Media is a single choice from the network's options; the image picker shows
  only for Image
- Shared code never branches on a network; differences go on the `Network`
  interface
- Claude drafts when Calvin presses D, never on its own: with the text box empty
  it drafts from the post, and with his text in it, it critiques and rewrites it.
  This gives him the chance to paste his own draft first (2026-11-27)
- The share thread and its Claude session are gitignored
  (`writing/threads/share/<slug>.json`), like the post threads (2026-11-27)
- Short link codes are six characters from an alphabet without look-alikes, and
  live in `src/data/short-links.json` (see
  `docs/decisions/2026-11-27-first-party-short-links.md`) (2026-11-27)
- When Calvin agrees to a voice rule in the thread, Claude adds it to
  `docs/voice.md` itself; it's the one file Claude may edit from the share page
  (2026-11-27)

## Docs to update when this lands

- `architecture.md`: the new folders, ports and view in "Layout", and the
  `write_social_post` exception in "How the pieces fit" (Claude writes these
  directly, unlike posts)
- A decision record for first-party short links
- `docs/writing.md` and the `/share` skill: point at the share page
