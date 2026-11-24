// Small drawing helpers shared by the scenes
import { el } from '../kit';

export type Pt = [number, number];
export const poly = (pts: Pt[], close = true) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + (close ? 'Z' : '');
/** Seeded random numbers, so a scene draws the same every time */
export const seeded = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export const shape = (parent: Element, pts: Pt[], fill: string, extra: Record<string, string | number> = {}) => el('path', { d: poly(pts), fill, ...extra }, parent);
export const line = (parent: Element, pts: Pt[], stroke: string, width: number, extra: Record<string, string | number> = {}) =>
  el('path', { d: poly(pts, false), fill: 'none', stroke, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra }, parent);

/** A two-tone pine (dark left, lit right), with a snow cap when `snow` is set */
export function pine(parent: Element, x: number, y: number, h: number, snow = false): void {
  const w = h * 0.34;
  shape(parent, [[x, y - h], [x - w, y], [x + w, y]], 'var(--tree)');
  shape(parent, [[x, y - h], [x + w, y], [x + w * 0.1, y]], 'var(--tree-lit)');
  if (snow) shape(parent, [[x, y - h], [x - w * 0.5, y - h * 0.5], [x - w * 0.15, y - h * 0.58], [x + w * 0.1, y - h * 0.45], [x + w * 0.5, y - h * 0.5]], 'var(--jr-snow)');
}

/** A faceted cloud: flat underside, lumpy top, lit from the upper right */
export function cloud(parent: Element, x: number, y: number, w: number, h: number, opacity = 1): SVGGElement {
  const g = el('g', { opacity }, parent);
  shape(g, [[x, y], [x + w * 0.08, y - h * 0.45], [x + w * 0.24, y - h * 0.6], [x + w * 0.36, y - h], [x + w * 0.56, y - h * 0.92], [x + w * 0.68, y - h * 0.6], [x + w * 0.86, y - h * 0.5], [x + w, y]], 'var(--jr-cloud-2)');
  shape(g, [[x + w * 0.36, y - h], [x + w * 0.56, y - h * 0.92], [x + w * 0.68, y - h * 0.6], [x + w * 0.86, y - h * 0.5], [x + w, y], [x + w * 0.5, y - h * 0.3]], 'var(--jr-cloud)');
  return g;
}

/** A layer of another material (snow, rock) lying on the scene's stretch of trail, tapering out at both ends */
export function groundBand(parent: Element, x0: number, x1: number, y: number, fill: string, edge: string): void {
  shape(parent, [[x0 - 30, y + 6], [x0, y - 4], [x1, y - 4], [x1 + 30, y + 6], [x1 + 14, y + 30], [x0 - 14, y + 30]], fill);
  shape(parent, [[x0 - 30, y + 6], [x0, y - 4], [x1, y - 4], [x1 + 30, y + 6], [x1, y + 4], [x0, y + 4]], edge);
}
