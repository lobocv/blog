import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MemoryPostLibrary } from '../app/testing/fakes.ts';
import { postLibraryContract } from './contracts/post-library.ts';
import { FsPostLibrary } from './fs-post-library.ts';

/** A temporary repo with the given files. */
async function repo(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), 'editor-repo-'));
  await mkdir(join(root, 'src/content/posts'), { recursive: true });
  for (const [path, text] of Object.entries(files)) {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), text);
  }
  return root;
}

const postFiles = (posts: Record<string, string>) =>
  Object.fromEntries(Object.entries(posts).map(([slug, text]) => [`src/content/posts/${slug}/index.md`, text]));

postLibraryContract(
  'memory',
  async (posts) => new MemoryPostLibrary(posts),
  async (lib, slug, text) => lib.editOutside(slug, text),
);
const roots = new WeakMap<FsPostLibrary, string>();
postLibraryContract(
  'files',
  async (posts) => {
    const root = await repo(postFiles(posts));
    const lib = new FsPostLibrary(root);
    roots.set(lib, root);
    return lib;
  },
  // As editors do: write a new file and rename it over the post.
  async (lib, slug, text) => {
    const path = join(roots.get(lib)!, 'src/content/posts', slug, 'index.md');
    await writeFile(`${path}.swp`, text);
    await rename(`${path}.swp`, path);
  },
);

describe('FsPostLibrary', () => {
  it('prefers index.mdx and skips folders without a post', async () => {
    const root = await repo({ 'src/content/posts/a/index.mdx': 'mdx', 'src/content/posts/empty/notes.txt': 'x' });
    const lib = new FsPostLibrary(root);
    expect((await lib.list()).map((p) => p.slug)).toEqual(['a']);
    expect(lib.pathOf('a')).toBe('src/content/posts/a/index.mdx');
  });

  it('writes in place and leaves no temporary file', async () => {
    const root = await repo(postFiles({ a: 'old' }));
    await new FsPostLibrary(root).write('a', 'new');
    expect(await readFile(join(root, 'src/content/posts/a/index.md'), 'utf8')).toBe('new');
    expect(await readdir(join(root, 'src/content/posts/a'))).toEqual(['index.md']);
  });

  it("moves a removed post's files to .trash, keeping their repo paths", async () => {
    const root = await repo({
      'src/content/posts/a/index.md': 'post',
      'src/content/posts/a/figure.svg': '<svg/>',
      'writing/briefs/a.md': 'brief',
      'public/posts/a/img.png': 'png',
      'writing/briefs/b.md': 'other brief',
    });
    await new FsPostLibrary(root).remove('a');

    const [entry] = await readdir(join(root, '.trash'));
    expect(entry).toMatch(/^a-\d{4}-/);
    const trash = join(root, '.trash', entry);
    expect(await readFile(join(trash, 'src/content/posts/a/figure.svg'), 'utf8')).toBe('<svg/>');
    expect(await readFile(join(trash, 'writing/briefs/a.md'), 'utf8')).toBe('brief');
    expect(await readFile(join(trash, 'public/posts/a/img.png'), 'utf8')).toBe('png');
    for (const gone of ['src/content/posts/a', 'writing/briefs/a.md', 'public/posts/a']) expect(existsSync(join(root, gone))).toBe(false);
    expect(existsSync(join(root, 'writing/briefs/b.md'))).toBe(true);
  });
});
