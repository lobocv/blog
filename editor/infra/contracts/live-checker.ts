// The behaviour every LiveChecker must have. `good` is a URL with a complete preview card,
// `bad` one that doesn't load.
import { describe, expect, it } from 'vitest';
import type { LiveChecker } from '../../app/ports.ts';

export function liveCheckerContract(name: string, make: () => Promise<{ checker: LiveChecker; good: string; bad: string }>) {
  describe(`LiveChecker contract: ${name}`, () => {
    it('passes every check for a page with a complete preview card', async () => {
      const { checker, good } = await make();
      const results = await checker.check(good);
      expect(results.length).toBeGreaterThan(0);
      expect(results.filter((r) => !r.ok)).toEqual([]);
    });

    it("fails, without rejecting, when the page doesn't load", async () => {
      const { checker, bad } = await make();
      const results = await checker.check(bad);
      expect(results.some((r) => !r.ok)).toBe(true);
      for (const r of results) expect(typeof r.message).toBe('string');
    });
  });
}
