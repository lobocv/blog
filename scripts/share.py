#!/usr/bin/env python3
"""Share kit for a published post: tagged links per platform, plus live checks
that the social preview card will render. No AI judgment, same answer every run.

Usage:
  python3 scripts/share.py           # the newest published post
  python3 scripts/share.py <slug>    # a specific post
  python3 scripts/share.py --offline # skip the live checks (eg before the deploy finishes)

Exit code is 1 when a live check fails, 0 otherwise.
"""

import re
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS = ROOT / "src" / "content" / "posts"
SITE = "https://www.lobocv.com"

# Channels posted through Buffer get a utm tag so analytics can tell them apart
# (X links arrive as t.co, which hides the source). Community sites get the clean
# URL: HN and Reddit match duplicates on the exact URL, and tags look like marketing.
TAGGED = ["x", "bluesky", "linkedin"]
LIMITS = {"x": 280, "bluesky": 300}


def front_matter(path):
    m = re.match(r"^---\n(.*?)\n---", path.read_text(), re.DOTALL)
    fm = m.group(1) if m else ""

    def field(name):
        f = re.search(rf"^{name}:\s*(.+)$", fm, re.MULTILINE)
        return f.group(1).strip().strip('"\'') if f else ""

    cats = re.findall(r'"([^"]+)"', field("categories"))
    return {"title": field("title"), "summary": field("summary"), "date": field("date"),
            "draft": field("draft") == "true", "categories": cats}


def posts():
    for index in [*POSTS.glob("*/index.md"), *POSTS.glob("*/index.mdx")]:
        yield index.parent.name, front_matter(index)


def pick(slug):
    found = dict(posts())
    if slug:
        if slug not in found:
            sys.exit(f"Post not found: {slug}")
        if found[slug]["draft"]:
            sys.exit(f"{slug} is still a draft. Publish it before sharing.")
        return slug, found[slug]
    live = [(s, fm) for s, fm in found.items() if not fm["draft"] and fm["date"]]
    if not live:
        sys.exit("No published posts.")
    return max(live, key=lambda p: p[1]["date"])


class Meta(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = {}

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        key = a.get("property") or a.get("name")
        if tag == "meta" and key and "content" in a:
            self.tags.setdefault(key, a["content"])


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "lobocv-share-check"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.status, r.headers.get("Content-Type", ""), r.read()


def live_checks(url):
    results = []
    try:
        status, _, body = fetch(url)
    except Exception as e:  # noqa: BLE001 - report any network failure as a failed check
        return [(False, f"page loads: {e}")]
    results.append((status == 200, f"page loads ({status})"))
    meta = Meta()
    meta.feed(body.decode("utf-8", "replace"))
    t = meta.tags
    for key in ["og:title", "og:description", "og:image", "twitter:card", "twitter:site"]:
        results.append((bool(t.get(key)), f"{key}: {t.get(key, 'missing')}"))
    results.append((t.get("twitter:card") == "summary_large_image", "large preview card"))
    if t.get("og:image"):
        try:
            status, ctype, _ = fetch(t["og:image"])
            results.append((status == 200 and ctype.startswith("image/"), f"og:image loads ({status}, {ctype})"))
        except Exception as e:  # noqa: BLE001
            results.append((False, f"og:image loads: {e}"))
    return results


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    offline = "--offline" in sys.argv
    slug, fm = pick(args[0] if args else None)
    url = f"{SITE}/posts/{slug}/"

    print(f"{fm['title']}\n{fm['summary']}\nCategories: {', '.join(fm['categories'])}\n")

    print("Buffer (one draft, tagged link per channel):")
    for ch in TAGGED:
        tagged = f"{url}?utm_source={ch}&utm_medium=social"
        limit = f"  ({LIMITS[ch]} chars)" if ch in LIMITS else ""
        print(f"  {ch:9} {tagged}{limit}")

    print("\nBy hand (clean URL):")
    hn = "https://news.ycombinator.com/submitlink?" + urllib.parse.urlencode({"u": url, "t": fm["title"]})
    print(f"  hn        {hn}")
    print(f"  reddit    {url}")
    print(f"  changelog https://changelog.com/news/submit  (paste {url})")
    print(f"\nPreview image: {SITE}/og/{slug}.png")

    if offline:
        return 0
    print("\nLive checks:")
    results = live_checks(url)
    for ok, msg in results:
        print(f"  {'ok  ' if ok else 'FAIL'} {msg}")
    return 0 if all(ok for ok, _ in results) else 1


if __name__ == "__main__":
    sys.exit(main())
