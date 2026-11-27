# Handoff: share page, milestone 1

A snapshot written on 2026-11-27 to start a fresh session. The design is
`sharing-design.md`; this file says what to build first and what was decided
along the way. Delete it once milestone 1 is merged.

## The task

Build milestone 1 of the editor's share page: LinkedIn, without Claude or
images. When it's done, Calvin can open a published post's share page, write
and check the LinkedIn text against a phone preview, copy it, open LinkedIn,
and record the posted URL, with everything saved under `writing/share/<slug>/`.

## Read first

1. `AGENTS.md`, then `docs/editor/architecture.md` (layers, ports, testing, UI
   conventions). Every rule there applies
2. `docs/editor/sharing-design.md`, the whole thing. The sections that matter
   most here: "Networks", "Architecture", "Links", "Files", "UI", "Decided"
3. The UI mock: https://claude.ai/artifact/JNbriQdY6PtPWk1X7KqEDe (read it with
   the Artifact tool). Its source is also in the scratchpad of the session that
   made it, which may be gone, so use the artifact. Two things in the mock are
   out of date:
   - it has a "No image" entry in the image picker. The design now has one media
     choice per tab and shows the picker only for Image
   - it shows a failing pre-flight disabling Copy. Pre-flight never blocks
4. `scripts/share.py`: the live checks to port, and the UTM format

## In scope

- The `Network` interface and a registry (`editor/domain/social/networks/`),
  with the LinkedIn module. Design it so X and Bluesky (milestone 5) need no
  code outside their own folders
- The no-branching rule, enforced in `editor/architecture.test.ts`: only the
  registry imports network modules, and outside the network folders, the
  registry and the preview components, no code compares a network id or names
  a specific network. Write this test early, it keeps the rest honest
- `domain/social/`: `social-post.ts` (text, hashtags, link, media choice, status,
  versions), `checks.ts` (length by the network's `count`, the fold, hashtag
  count, banned words, em-dashes), `links.ts` (tagged URLs), `hashtags.ts`
  (categories to candidates, trimmed to the network's limit)
- `app/`: `open-share.ts` (load or create the share state, run pre-flight),
  saving a version, `mark-posted.ts`
- Ports with fakes and contract suites: `ShareStore` (`writing/share/<slug>/`
  with `share.json` and `linkedin.txt`) and `LiveChecker` (page loads, OG tags,
  preview image loads)
- Server routes and `protocol.ts` messages
- `ui/views/ShareView.tsx` at `/?share=<slug>`:
  - opened with S on a published post in the posts page, and ⌥S in the editor
  - network tabs by number, even though only LinkedIn exists
  - the text box with the count, the fold line and failing checks only
  - the LinkedIn phone preview (`ui/share/previews/linkedin.tsx`), always on,
    which measures where the fold falls in lines and reports it back
  - hashtag chips, the link with copy, the media choice (link card or text only
    for now; Image arrives with milestone 2)
  - Copy text (C), Open LinkedIn (O), the posted URL field, versions in a menu
  - the new keys in `ui/keymap.ts`, so they show on the key sheet
- Retire the old share kit at the end: delete `scripts/share.py` and the
  `share` target in the `Makefile`, and point step 1 of the `/share` skill
  (`.agents/skills/share/SKILL.md`) and step 9 of the workflow in
  `docs/writing.md` at the share page

## Out of scope

- Claude (milestone 3): no drafting, no `write_social_post` tool, no share
  session. The text starts empty or from what Calvin pastes
- Images (milestone 2) and short links (milestone 4)
- X and Bluesky modules (milestone 5), and posting through APIs

## Things to know

- Banned words: `scripts/lint_post.py` has the list (`BANNED`). The editor needs
  it in TypeScript; move it into `shared/` so the editor and the blog's tooling
  can't drift, or note the duplication if moving it is more than a small change
- Categories to hashtags: a hand-kept map is fine for now. Claude picks
  hashtags in milestone 3
- LinkedIn numbers (character limit, fold lines on a phone, hashtag advice):
  check them against LinkedIn's own help pages before writing them into the
  module, not from memory. Marketing blogs disagree with each other
- The tagged link is `<post URL>?utm_source=linkedin&utm_medium=social`. GA4 is
  already on the site, so these show up under Traffic acquisition. The post
  share buttons use `utm_medium=share`
- LinkedIn shows either an image or a link card, never both, and the URL in the
  text stays clickable when there's an image. Its feed cuts posts after about 3
  lines on a phone
- The editor never commits (see `architecture.md`). Commit as you go in the
  session, with Calvin's approval to push
- `writing/share/` is committed, images included. It already holds the LinkedIn
  images for the agents post

## Done when

- Calvin can do the flow above on the agents post, and the files on disk match
  what's on screen
- `make verify` and `make verify-editor` pass, including the new architecture
  rule and a Playwright test that opens a share page, types, and checks
  `linkedin.txt` on disk
- `architecture.md` lists the new folders, ports and view, as
  `sharing-design.md` "Docs to update" says
- The share page has been checked by eye in the browser, with screenshots
