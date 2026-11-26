// The behaviour every PostLibrary must have. Runs against the in-memory fake
// and the real file library, so the fake can't drift from reality.
import { describe, expect, it, vi } from 'vitest';
import type { PostLibrary } from '../../app/ports.ts';

export function postLibraryContract<L extends PostLibrary>(
  name: string,
  make: (posts: Record<string, string>) => Promise<L>,
  /** Changes a post the way another program would. */
  editOutside: (lib: L, slug: string, text: string) => Promise<void>,
) {
  describe(`PostLibrary contract: ${name}`, () => {
    it('lists every post by slug', async () => {
      const lib = await make({ b: 'B', a: 'A' });
      expect((await lib.list()).map((p) => [p.slug, p.text])).toEqual([['a', 'A'], ['b', 'B']]);
    });

    it('reads a post, or undefined when there is none', async () => {
      const lib = await make({ a: '---\ndraft: true\n---\nHello' });
      expect((await lib.read('a'))?.text).toBe('---\ndraft: true\n---\nHello');
      expect((await lib.read('a'))?.modified).toBeInstanceOf(Date);
      expect(await lib.read('missing')).toBeUndefined();
    });

    it('reads back what was written, keeping unicode and line endings', async () => {
      const lib = await make({ a: 'old' });
      for (const text of ['naïve café 👋\r\nline two\n', '']) {
        await lib.write('a', text);
        expect((await lib.read('a'))?.text).toBe(text);
      }
    });

    it('removes a post', async () => {
      const lib = await make({ a: 'A', b: 'B' });
      await lib.remove('a');
      expect(await lib.read('a')).toBeUndefined();
      expect((await lib.list()).map((p) => p.slug)).toEqual(['b']);
    });

    it('gives a repo path for each post', async () => {
      const lib = await make({ a: 'A' });
      expect(lib.pathOf('a')).toMatch(/^src\/content\/posts\/a\/index\.mdx?$/);
    });

    it('tells watchers about outside edits, but not its own writes', async () => {
      const lib = await make({ a: 'one' });
      const seen: string[] = [];
      const stop = lib.watch('a', (text) => seen.push(text));
      await new Promise((r) => setTimeout(r, 100));
      await lib.write('a', 'mine');
      await new Promise((r) => setTimeout(r, 200));
      await editOutside(lib, 'a', 'theirs');
      await vi.waitFor(() => expect(seen).toEqual(['theirs']), { timeout: 2000 });
      stop();
      await editOutside(lib, 'a', 'after');
      await new Promise((r) => setTimeout(r, 200));
      expect(seen).toEqual(['theirs']);
    });
  });
}
