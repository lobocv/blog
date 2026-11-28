---
name: share
description: Share a published post. LinkedIn goes through the editor's share page (pre-flight, text, checks, phone preview, posted URL); X and Bluesky get tagged links; HN, Reddit and Changelog are posted by hand with the clean URL. Use when Calvin says /share or asks how to share or promote a post.
---

# Share a published post

Runs after `/ship` and the deploy. Uses the post Calvin names, otherwise the
newest published post.

1. Open the post's share page: `make write`, pick the post and press S, or go
   straight to `/?share=<slug>`. Pre-flight runs there (the live page, its OG
   tags and the preview image). If it fails because the deploy hasn't finished,
   say so and check again later. Any other failure (eg missing `og:image`) is a
   site bug to fix first
2. Give Calvin the plan, network by network:
   - LinkedIn: the share page. It has the tagged link, hashtags, the checks and
     the phone preview; C copies the text, P opens LinkedIn, and the posted URL
     goes in the field below. Everything is saved in `writing/share/<slug>/`
     (`linkedin.txt` is always ready to paste)
   - X and Bluesky: through Buffer, each with its tagged link,
     `<post URL>?utm_source=x&utm_medium=social` (or `utm_source=bluesky`). The
     preview card comes from the post's OG tags, so no image upload is needed
   - Hacker News: `https://news.ycombinator.com/submitlink?u=<post URL>&t=<title>`,
     both URL-encoded, with the post's real title. No "Show HN" (that is for
     things people can try), and never ask anyone to upvote
   - Reddit: suggest subreddits from the categories (below). Calvin checks each
     subreddit's self-promotion rules before posting
   - Changelog News: https://changelog.com/news/submit with the clean URL (needs a
     Changelog account)
3. Social posts: unlike blog posts, you may write these. Calvin decided this
   on 2026-11-27, because working critique into a short post by hand was slower
   than reviewing a rewrite
   - If Calvin has a draft, critique it (length against the limits, AI tells,
     whether the first line gives a reason to click), then write the revised post
     with the feedback applied. Keep his phrasing wherever it already works
   - With no draft, write one from the post itself
   - Write in his voice (`docs/voice.md`), state only what the post or Calvin
     says (no invented numbers or experiences), and no pitching Trellis
   - Calvin reviews and edits before posting. Never post for him

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
- Don't add utm tags to HN, Reddit or Changelog links: they match duplicates on
  the exact URL, and tags look like marketing
- Don't suggest newsletters without a public submit page. Golang Weekly, TLDR
  and Pointer had none when checked (2026-11)
