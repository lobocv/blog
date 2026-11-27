// The behaviour every ImageRenderer must have. `target` is a figure the renderer can reach.
import { describe, expect, it } from 'vitest';
import type { ImageRenderer, RenderTarget } from '../../app/ports.ts';

/** A PNG's size, from its header chunk. */
export function pngSize(png: Uint8Array) {
  expect([...png.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(png.buffer, png.byteOffset);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

export function imageRendererContract(name: string, make: () => Promise<{ renderer: ImageRenderer; target: RenderTarget }>) {
  describe(`ImageRenderer contract: ${name}`, () => {
    it('renders at the size asked for, given the figure\'s own size', async () => {
      const { renderer, target } = await make();
      let seen: { width: number; height: number } | undefined;
      const { png, figure } = await renderer.render(target, { theme: 'day', size: (f) => ((seen = f), { width: 1200, height: 628 }) });
      expect(seen).toEqual(figure);
      expect(figure.width).toBeGreaterThan(0);
      expect(pngSize(png)).toEqual({ width: 1200, height: 628 });
    });

    it('renders other shapes too', async () => {
      const { renderer, target } = await make();
      const { png } = await renderer.render(target, { theme: 'night', size: () => ({ width: 1080, height: 1350 }) });
      expect(pngSize(png)).toEqual({ width: 1080, height: 1350 });
    });
  });
}
