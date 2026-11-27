#!/usr/bin/env python3
"""Mechanical checks for a blog post. No AI judgment, same answer every run.

Usage:
  python3 scripts/lint_post.py              # lint the active post
  python3 scripts/lint_post.py <path|slug>  # lint a specific post
  python3 scripts/lint_post.py --links      # also check that external links resolve
  python3 scripts/lint_post.py --active     # print the active post's path and exit
  python3 scripts/lint_post.py projects/<slug>  # lint a project page (no length cap)

The active post is the post under src/content/posts/ whose front matter has
`draft: true`. If there is more than one, pass the path or slug explicitly.

Exit code is 1 when any check fails, 0 otherwise. Warnings don't fail.
"""

import math
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS = ROOT / "src" / "content" / "posts"
PROJECTS = ROOT / "src" / "content" / "projects"

WORDS_PER_MINUTE = 213  # Hugo's reading-time rate
HARD_CAP = 2000         # about 10 minutes
SOFT_CAP = 1800

# Phrases that make writing read as AI-generated or padded, shared with the
# editor. "harness" is deliberately absent because it is a real topic on this blog.
BANNED = json.loads((ROOT / "shared" / "banned-words.json").read_text())["phrases"]
BANNED_RE = re.compile(
    r"(?<!\w)(?:"
    + "|".join(re.escape(p["text"]) + (r"\w*" if p.get("prefix") else "") for p in BANNED)
    + r")(?!\w)",
    re.IGNORECASE,
)


def banned(line):
    """Banned phrases in a line, matched with curly apostrophes read as straight ones."""
    return BANNED_RE.finditer(line.replace("\u2018", "'").replace("\u2019", "'"))


def drafts():
    found = []
    for index in [*POSTS.glob("*/index.md"), *POSTS.glob("*/index.mdx")]:
        fm, _ = split_front_matter(index.read_text())
        if re.search(r"^draft:\s*true\s*$", fm, re.MULTILINE):
            found.append(index)
    return found


def resolve(arg):
    if arg is None:
        found = drafts()
        if len(found) == 1:
            return found[0]
        if not found:
            sys.exit("No active post (no index.md with `draft: true`). Pass a path or slug.")
        names = ", ".join(p.parent.name for p in found)
        sys.exit(f"More than one draft ({names}). Pass a path or slug.")
    p = Path(arg)
    if p.is_dir():
        p = p / "index.md" if (p / "index.md").exists() else p / "index.mdx"
    if not p.exists() and arg.startswith("projects/"):
        p = PROJECTS / arg.split("/", 1)[1] / "index.mdx"
    if not p.exists():
        p = POSTS / arg / "index.md"
    if not p.exists():
        p = POSTS / arg / "index.mdx"
    if not p.exists():
        sys.exit(f"Post not found: {arg}")
    return p.resolve()


def split_front_matter(text):
    m = re.match(r"^---\n(.*?)\n---\n?", text, re.DOTALL)
    if not m:
        return "", text
    return m.group(1), text[m.end():]


def prose_lines(body):
    """Yield (line_number, line) for lines outside fenced code blocks."""
    in_code = False
    for n, line in enumerate(body.splitlines(), 1):
        if line.lstrip().startswith("```"):
            in_code = not in_code
            continue
        if not in_code:
            yield n, line


def check_link(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (link-check)"})
    for method in ("HEAD", "GET"):
        req.method = method
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return r.status
        except urllib.error.HTTPError as e:
            if method == "GET":
                return e.code
        except Exception as e:  # noqa: BLE001
            if method == "GET":
                return str(e)
    return None


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}

    post = resolve(args[0] if args else None)
    if "--active" in flags:
        print(post.relative_to(ROOT))
        return 0

    text = post.read_text()
    _, body = split_front_matter(text)
    offset = text[: len(text) - len(body)].count("\n")
    fails, warns = [], []

    # Length
    total = len(body.split())
    prose = sum(len(l.split()) for _, l in prose_lines(body))
    minutes = math.ceil(total / WORDS_PER_MINUTE)
    print(f"{post.relative_to(ROOT)}")
    print(f"  words: {total} total, {prose} prose, about {minutes} min read")
    is_project = "projects" in post.parts
    if is_project:
        pass  # project pages are layered and mostly collapsed, so the reading-time cap doesn't apply
    elif total > HARD_CAP:
        fails.append(f"length: {total} words is over the {HARD_CAP} cap (10 min)")
    elif total > SOFT_CAP:
        warns.append(f"length: {total} words is over the {SOFT_CAP} target")

    # Em-dashes and banned phrases
    for n, line in prose_lines(body):
        ln = n + offset
        if "—" in line:
            fails.append(f"line {ln}: em-dash")
        for m in banned(line):
            warns.append(f"line {ln}: \"{m.group(0)}\"")

    # Drafting notes for Claude (@@ ...), which must be resolved before publishing
    for n, line in prose_lines(body):
        for note in re.findall(r"@@[ \t]*(.*?)[ \t]*(?:@@|$)", line):
            warns.append(f"line {n + offset}: note \"{note}\" (run /notes)")

    # Images: alt text and local files
    for n, line in prose_lines(body):
        ln = n + offset
        for alt, src in re.findall(r"!\[([^\]]*)\]\(([^)\s]+)[^)]*\)", line):
            if not alt.strip():
                fails.append(f"line {ln}: image without alt text ({src})")
            check_local(src, post, ln, fails)
        for tag in re.findall(r"<img\b[^>]*>", line, re.IGNORECASE):
            if not re.search(r'\balt="[^"]+"', tag):
                fails.append(f"line {ln}: <img> without alt text")
            src = re.search(r'\bsrc="([^"]+)"', tag)
            if src:
                check_local(src.group(1), post, ln, fails)

    # External links
    if "--links" in flags:
        urls = set()
        for _, line in prose_lines(body):
            urls.update(re.findall(r"\]\((https?://[^)\s]+)", line))
            urls.update(re.findall(r'href="(https?://[^"]+)"', line))
        for url in sorted(urls):
            status = check_link(url)
            if isinstance(status, int) and status < 400:
                continue
            if status in (401, 403, 429):
                warns.append(f"link {url}: {status} (site may block bots, check by hand)")
            else:
                fails.append(f"link {url}: {status}")
        print(f"  links checked: {len(urls)}")

    for w in warns:
        print(f"  WARN  {w}")
    for f in fails:
        print(f"  FAIL  {f}")
    if not warns and not fails:
        print("  OK")
    return 1 if fails else 0


def check_local(src, post, ln, fails):
    if re.match(r"^(https?:)?//", src) or src.startswith("data:"):
        return
    path = (ROOT / "static" / src.lstrip("/")) if src.startswith("/") else (post.parent / src)
    if not path.exists():
        fails.append(f"line {ln}: image not found ({src})")


if __name__ == "__main__":
    sys.exit(main())
