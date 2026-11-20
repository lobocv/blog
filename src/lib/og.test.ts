import { describe, expect, it } from 'vitest';
import { horizonSvg, renderOg } from './og';

describe('horizonSvg', () => {
  it('resolves every CSS variable and class so resvg can draw it', () => {
    const svg = horizonSvg();
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('var(');
    expect(svg).not.toMatch(/class="(t|tl|night-only)"/);
  });
});

describe('renderOg', () => {
  it('renders a 1200x630 PNG', async () => {
    const png = await renderOg({ title: 'Testing complex workflows in Go', summary: 'A short summary.' });
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
});
