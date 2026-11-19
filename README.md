# blog.lobocv.com

Source for [blog.lobocv.com](https://blog.lobocv.com). This README covers how
the repo works: the layout, running and publishing the site, and how AI agents
help with writing posts.

## Layout

```
content/posts/<slug>/index.md   a post, with its images and diagrams next to it
content/about/                  the about page
writing/ideas.md                post ideas and parked tangents
writing/briefs/<slug>.md        each post's thesis, reader, takeaway and scope
writing/feedback.md             patterns that keep coming up in my drafts
scripts/lint_post.py            mechanical checks for a post
AGENTS.md                       rules every agent follows when helping me write
.agents/skills/                 the writing skills (slash commands)
.claude/skills/                 links to .agents/skills so Claude Code finds them
themes/                         Hugo theme (git submodule)
static/                         files served as-is (favicon, CNAME, images)
```

`content/` is what gets published. `writing/` is scaffolding that never ships.

## Running the site

The site builds with Hugo inside Docker.

```bash
git submodule update --init   # first time only, pulls the theme
./build_image.sh              # builds the calvin-blog image
./run.sh                      # serves on http://localhost:1313
```

`run.sh` doesn't show drafts. To preview a draft, add `-D`:

```bash
docker run -it -v $PWD:/src -p "1313:1313" calvin-blog server -D -b "localhost:1313/"
```

## Publishing

Pushing to `master` deploys to GitHub Pages through the workflow in
`.github/workflows/`. The deploy doesn't build drafts, so a post with
`draft: true` can sit on `master` safely. To publish, set `draft: false`,
update the date, commit and push.

## Writing with agents

The agents are there to help me write, not to write for me. I write every
sentence that ships. The agents help with scope, structure, critique, research,
links and diagrams, and they never reword my prose without asking and explaining
why. The full set of rules is in [AGENTS.md](AGENTS.md), which Claude Code loads
through `CLAUDE.md` and other agents (eg Codex) read directly.

### The active post

Skills work on the active post unless I name a different one. The active post is
whichever post under `content/posts/` has `draft: true`.

- One draft: agents use it without asking
- Several drafts: agents ask once per session which one
- No drafts: agents suggest `/scope`

There's no separate drafting folder and no branch per post. Check which post is
active with:

```bash
python3 scripts/lint_post.py --active
```

### Skills

Each step of writing a post has a skill, run as a slash command.

| Command | What it does | What it touches |
|---|---|---|
| `/idea <text>` | Adds one dated line in my own words. With no text, lists the ideas | `writing/ideas.md` |
| `/scope [idea]` | Asks me questions to pin down the thesis, reader, takeaway and what's out of scope | Creates the brief and an empty draft post |
| `/outline` | Proposes a section order as short fragments, then writes it in as headings with the fragments in HTML comments | The post |
| `/critique [structure\|line\|audience]` | Prioritized feedback, with the reason behind each point. No edits to my prose | Nothing (only mechanical fixes, and only if I say yes) |
| `/diagram <what to show>` | Writes D2 source, renders it to SVG and inserts it where the reader first needs it | The post bundle |
| `/sources <claim or term>` | Finds primary sources and checks the links. I decide what goes in | Nothing |
| `/ship` | Runs the lint script with link checks, then a final read against the brief | Nothing |

The skills live in `.agents/skills/<name>/SKILL.md`. Each one points back to the
relevant section of AGENTS.md instead of repeating it, so rules only need
changing in one place.

### Flow for a post

1. `/idea` whenever something comes up (or edit `writing/ideas.md` by hand)
2. `/scope` to turn an idea into a brief and a draft
3. `/outline` to agree on the order of sections
4. Write the draft myself. `/sources` and `/diagram` are fine along the way
5. `/critique structure`, then revise
6. `/critique line`, then revise
7. `/ship`, then publish

Structure comes before line edits so I don't polish paragraphs that end up cut.
After a post ships, any pattern worth learning goes into `writing/feedback.md`.

### Lint script

`scripts/lint_post.py` does the checks that don't need AI judgment, so it gives
the same answer every run and works without an agent.

```bash
python3 scripts/lint_post.py                 # lint the active post
python3 scripts/lint_post.py <slug|path>     # lint a specific post
python3 scripts/lint_post.py --links         # also check external links
```

- Fails on: over 2,000 words (about 10 minutes), em-dashes, images without alt
  text, images that don't resolve, dead links
- Warns on: over 1,800 words, words that read as AI-written (the list is
  `BANNED` in the script), links that block bots

### Diagrams

`/diagram` keeps the D2 source (`<name>.d2`) next to the rendered SVG so a diagram
can be edited and re-rendered later. Rendering needs the `d2` CLI
(`brew install d2`). Without it, the skill hand-writes the SVG.

### Changing how the agents behave

- Writing rules, tone, length, audience: edit `AGENTS.md`
- What a single command does: edit its `.agents/skills/<name>/SKILL.md`
- Words the lint script flags: edit `BANNED` in `scripts/lint_post.py`
- New skill: add `.agents/skills/<name>/SKILL.md`, then link it with
  `ln -s ../../.agents/skills/<name> .claude/skills/<name>`
