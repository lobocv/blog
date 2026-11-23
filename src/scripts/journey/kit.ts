// Shared pieces for drawing scenes: the layer and prop contract, the ground line and an SVG helper.

export interface SceneLayers { far: SVGGElement; mid: SVGGElement; ground: SVGGElement }
/** World span of the scene and the x of each chapter in it */
export interface SceneCtx { x0: number; x1: number; chapterX: number[] }
/**
 * An element that reacts to the wolf. `x` is in its own layer's coordinates.
 * rise (default): rises in while the wolf is within reach. draw: its strokes draw in once the wolf
 * has reached x, and undraw on rewind (paths need pathLength="1").
 */
export interface Prop { el: SVGGElement; x: number; layer: 0.3 | 0.6 | 1; kind?: 'rise' | 'draw' }
/** Drawn at the wolf's feet (not scaled with it) and shown while the wolf is between x0 and x1 in world x */
export interface Follow { el: SVGGElement; x0: number; x1: number }
export type DrawScene = (layers: SceneLayers, ctx: SceneCtx) => { props?: Prop[]; follow?: Follow[] };

export const GROUND_Y = 272;
/** The wolf's fixed x in the 1600-wide viewBox, near the centre so it survives the phone crop */
export const WOLF_X = 740;
/** Where something at world x belongs in a layer moving at speed k, so it passes the wolf when the wolf reaches x */
export const layerX = (x: number, k: number) => WOLF_X + k * (x - WOLF_X);
const NS = 'http://www.w3.org/2000/svg';

export function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, String(attrs[k]));
  parent?.appendChild(n);
  return n;
}
