// The behaviour every PostLibrary must have. Runs against the in-memory fake
// and the real file library, so the fake can't drift from reality.
import { describe, expect, it } from 'vitest';
import type { PostLibrary } from '../../app/ports.ts';

export function postLibraryContract(name: string, make: (posts: Record<string, string>) => Promise<PostLibrary>) {
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
  });
}
