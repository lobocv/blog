// The behaviour every IdeasFile must have. Runs against the in-memory fake and the real file.
import { describe, expect, it } from 'vitest';
import type { IdeasFile } from '../../app/ports.ts';

export function ideasFileContract(name: string, make: () => Promise<IdeasFile>) {
  describe(`IdeasFile contract: ${name}`, () => {
    it('reads an empty string before anything is written', async () => {
      expect(await (await make()).read()).toBe('');
    });

    it('reads back what was written', async () => {
      const file = await make();
      await file.write('# Ideas\n\n- 2026-11-26: naïve 👋\n');
      expect(await file.read()).toBe('# Ideas\n\n- 2026-11-26: naïve 👋\n');
    });
  });
}
