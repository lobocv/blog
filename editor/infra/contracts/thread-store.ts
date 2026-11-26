// The behaviour every ThreadStore must have. Runs against the in-memory fake and the JSON files.
import { describe, expect, it } from 'vitest';
import type { ThreadStore } from '../../app/ports.ts';
import type { Thread } from '../../domain/thread.ts';

const thread: Thread = {
  id: 't1',
  anchor: { quote: 'naïve "quote"', line: 3 },
  resolved: false,
  messages: [{ author: 'calvin', text: 'why? 👋', at: '2026-11-25T12:00:00.000Z' }],
};

export function threadStoreContract(name: string, make: () => Promise<ThreadStore>) {
  describe(`ThreadStore contract: ${name}`, () => {
    it('loads an empty list for a post without threads', async () => {
      expect(await (await make()).load('a')).toEqual([]);
    });

    it('loads what was saved, per post', async () => {
      const store = await make();
      await store.save('a', [thread]);
      expect(await store.load('a')).toEqual([thread]);
      expect(await store.load('b')).toEqual([]);
    });

    it('replaces what was saved before', async () => {
      const store = await make();
      await store.save('a', [thread]);
      await store.save('a', []);
      expect(await store.load('a')).toEqual([]);
    });

    it("doesn't share objects with the caller", async () => {
      const store = await make();
      const saved = [structuredClone(thread)];
      await store.save('a', saved);
      saved[0].resolved = true;
      expect((await store.load('a'))[0].resolved).toBe(false);
    });
  });
}
