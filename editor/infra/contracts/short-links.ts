// The behaviour every ShortLinks must have. Runs against the in-memory fake and the data file.
import { describe, expect, it } from 'vitest';
import { Refused } from '../../app/errors.ts';
import type { ShortLinks } from '../../app/ports.ts';

export function shortLinksContract(name: string, make: () => Promise<ShortLinks>) {
  describe(`ShortLinks contract: ${name}`, () => {
    it('starts empty, then has what was added', async () => {
      const links = await make();
      expect(await links.all()).toEqual({});
      await links.add('k3x9q2', { post: 'a', to: '/posts/a/?utm_source=x&utm_medium=social' });
      expect(await links.all()).toEqual({ k3x9q2: { post: 'a', to: '/posts/a/?utm_source=x&utm_medium=social' } });
    });

    it('refuses a code that is taken, keeping the first', async () => {
      const links = await make();
      await links.add('k3x9q2', { post: 'a', to: '/posts/a/' });
      await expect(links.add('k3x9q2', { post: 'b', to: '/posts/b/' })).rejects.toBeInstanceOf(Refused);
      expect((await links.all()).k3x9q2.post).toBe('a');
    });

    it('keeps every one of many adds made at once', async () => {
      const links = await make();
      await Promise.all(Array.from({ length: 20 }, (_, i) => links.add(`code${String(i).padStart(2, '0')}`, { post: 'a', to: '/posts/a/' })));
      expect(Object.keys(await links.all())).toHaveLength(20);
    });

    it("doesn't share objects with the caller", async () => {
      const links = await make();
      const link = { post: 'a', to: '/posts/a/' };
      await links.add('k3x9q2', link);
      link.post = 'changed';
      (await links.all()).k3x9q2.post = 'changed too';
      expect((await links.all()).k3x9q2.post).toBe('a');
    });
  });
}
