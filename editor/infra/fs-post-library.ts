import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import type { PostLibrary } from '../app/ports.ts';

/**
 * Posts as `src/content/posts/<slug>/index.md` (or `.mdx`) under the repo
 * `root`. Removed posts go to `<root>/.trash/` (gitignored) with their brief,
 * images and threads, laid out as in the repo so they can be moved back.
 */
export class FsPostLibrary implements PostLibrary {
  private root: string;
  private posts: string;

  constructor(root: string) {
    this.root = root;
    this.posts = join(root, 'src/content/posts');
  }

  private file(slug: string): string | undefined {
    return ['index.mdx', 'index.md'].map((f) => join(this.posts, slug, f)).find((p) => existsSync(p));
  }

  async list() {
    const posts = [];
    for (const slug of (await readdir(this.posts)).sort()) {
      const post = await this.read(slug);
      if (post) posts.push(post);
    }
    return posts;
  }

  async read(slug: string) {
    const path = this.file(slug);
    if (!path) return undefined;
    const [text, info] = await Promise.all([readFile(path, 'utf8'), stat(path)]);
    return { slug, text, modified: info.mtime };
  }

  pathOf(slug: string) {
    return relative(this.root, this.file(slug) ?? join(this.posts, slug, 'index.md'));
  }

  // Write a temporary file and rename it over the post, so the dev server and
  // other editors never see a half-written file.
  async write(slug: string, text: string) {
    const path = this.file(slug) ?? join(this.posts, slug, 'index.md');
    const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
    await writeFile(tmp, text, 'utf8');
    await rename(tmp, path);
  }

  async remove(slug: string) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const trash = join(this.root, '.trash', `${slug}-${stamp}`);
    const owned = [`src/content/posts/${slug}`, `writing/briefs/${slug}.md`, `writing/threads/${slug}.json`, `public/posts/${slug}`];
    for (const rel of owned) {
      const from = join(this.root, rel);
      if (!existsSync(from)) continue;
      const to = join(trash, rel);
      await mkdir(dirname(to), { recursive: true });
      await cp(from, to, { recursive: true });
      await rm(from, { recursive: true });
    }
  }
}
