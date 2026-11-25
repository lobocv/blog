---
name: share
description: Share kit for a published post. Prints tagged links per platform, checks the live social preview card, and gives a per-platform checklist (Buffer for X, Bluesky and LinkedIn; HN, Reddit and Changelog by hand). Use when Calvin says /share or asks how to share or promote a post.
---

# Share a published post

Runs after `/ship` and the deploy. Uses the post Calvin names, otherwise the
newest published post.

1. Run `make share POST=<slug>` (or `python3 scripts/share.py` for the newest).
   If the live checks fail because the deploy hasn't finished, say so and rerun
   later. Any other failure (eg missing `og:image`) is a site bug to fix first
2. Show Calvin the kit, grouped like this:
   - Buffer: one draft sent to X, Bluesky and LinkedIn, using each channel's tagged
     link. The preview card comes from the post's OG tags, so no image upload is needed
   - Hacker News: the `submitlink` URL with the post's real title. No "Show HN"
     (that is for things people can try), and never ask anyone to upvote
   - Reddit: suggest subreddits from the categories (below). Calvin checks each
     subreddit's self-promotion rules before posting
   - Changelog News: the submit page (needs a Changelog account)
3. If Calvin drafts the social posts here, critique them the usual way (see
   "Critique protocol" in `AGENTS.md`): length against the limits, AI tells, and
   whether the first line gives a reason to click. Don't write them for him. The
   one rule applies to social posts too

## Subreddits by category

- Golang: r/golang
- Architecture, Design Patterns, Decoupling: r/softwarearchitecture
- Databases: r/PostgreSQL when the post is Postgres-specific, otherwise r/Database
- AI: r/ClaudeAI or r/ChatGPTCoding, only when the post is about working with
  coding agents
- Broad engineering posts: r/programming

One or two subreddits per post, not all of them. Posting the same link to many
subreddits at once reads as spam.

## What not to do

- Don't automate posting to Reddit or HN
- Don't add utm tags to HN, Reddit or Changelog links (the script already leaves
  them clean)
- Don't suggest newsletters without a public submit page. Golang Weekly, TLDR
  and Pointer had none when checked (2026-11)
