// The behaviour every ShareStore must have. Runs against the in-memory fake and the files.
import { describe, expect, it } from 'vitest';
import type { ShareStore } from '../../app/ports.ts';
import type { ShareState } from '../../domain/social/social-post.ts';

const state = (text: string): ShareState => ({
  schemaVersion: 1,
  networks: { net: { text, hashtags: ['Tag'], status: 'draft', versions: [{ text: 'naïve "v1" 👋', hashtags: [], author: 'calvin', at: '2026-11-27T10:00:00.000Z' }] } },
});

export function shareStoreContract(name: string, make: () => Promise<ShareStore>) {
  describe(`ShareStore contract: ${name}`, () => {
    it('has nothing for a post never shared', async () => {
      expect(await (await make()).load('a')).toBeUndefined();
    });

    it('loads what was saved, per post', async () => {
      const store = await make();
      expect(await store.update('a', () => ({ state: state('hello'), texts: { net: 'hello' } }))).toEqual(state('hello'));
      expect(await store.load('a')).toEqual(state('hello'));
      expect(await store.load('b')).toBeUndefined();
    });

    it('hands each update the current state', async () => {
      const store = await make();
      await store.update('a', () => ({ state: state('one'), texts: {} }));
      let seen: ShareState | undefined;
      await store.update('a', (current) => ((seen = current), { state: state('two'), texts: {} }));
      expect(seen).toEqual(state('one'));
    });

    it('applies every one of many overlapping updates', async () => {
      const store = await make();
      await store.update('a', () => ({ state: state(''), texts: {} }));
      await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          store.update('a', (current) => {
            const next = structuredClone(current!);
            next.networks.net.text += `${i},`;
            return { state: next, texts: { net: next.networks.net.text } };
          }),
        ),
      );
      expect((await store.load('a'))!.networks.net.text.split(',').filter(Boolean)).toHaveLength(20);
    });

    it('keeps going after an update fails', async () => {
      const store = await make();
      await expect(store.update('a', () => { throw new Error('boom'); })).rejects.toThrow('boom');
      await store.update('a', () => ({ state: state('after'), texts: {} }));
      expect((await store.load('a'))!.networks.net.text).toBe('after');
    });

    it("doesn't share objects with the caller", async () => {
      const store = await make();
      const mine = state('x');
      const saved = await store.update('a', () => ({ state: mine, texts: {} }));
      mine.networks.net.text = 'changed';
      saved.networks.net.text = 'changed too';
      expect((await store.load('a'))!.networks.net.text).toBe('x');
    });

    it('writes and reads back images, per post and network', async () => {
      const store = await make();
      expect(await store.readImage('a', 'net')).toBeUndefined();
      await store.writeImage('a', 'net', new Uint8Array([1, 2, 3]));
      await store.writeImage('a', 'net', new Uint8Array([4, 5]));
      expect([...(await store.readImage('a', 'net'))!]).toEqual([4, 5]);
      expect(await store.readImage('b', 'net')).toBeUndefined();
      expect(await store.readImage('a', 'other')).toBeUndefined();
    });
  });
}
