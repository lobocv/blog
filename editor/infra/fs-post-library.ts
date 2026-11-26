import { existsSync, readFileSync, watch } from 'node:fs';
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
  /** What this library last wrote to each post, so watchers can tell its writes from others'. */
  private written = new Map<string, string>();

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
    this.written.set(slug, text);
    // A new post gets its own folder.
    await mkdir(dirname(path), { recursive: true });
    await writeFile(tmp, text, 'utf8');
    await rename(tmp, path);
  }

  // Watches the post's folder rather than the file: editors (and this library) replace the file
  // by renaming over it, which ends a watch on the file itself.
  watch(slug: string, onOutsideEdit: (text: string) => void) {
    const file = this.file(slug);
    // Read now, so an edit made straight after this call still counts as a change.
    let seen = file ? readFileSync(file, 'utf8') : undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      const post = await this.read(slug).catch(() => undefined);
      if (!post || post.text === seen || post.text === this.written.get(slug)) return;
      seen = post.text;
      onOutsideEdit(post.text);
    };
    // One check per burst of events (a save is often several).
    const watcher = watch(join(this.posts, slug), () => {
      clearTimeout(timer);
      timer = setTimeout(() => void check(), 50);
    });
    watcher.on('error', () => {});
    return () => {
      clearTimeout(timer);
      watcher.close();
    };
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
