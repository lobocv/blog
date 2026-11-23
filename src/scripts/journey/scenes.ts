// One draw function per scene. Each draws into the shared layers over its own world span.
// Every scene but the radar one is a labelled placeholder until its art is drawn.
import type { SceneId } from '../../data/timeline';

export interface SceneLayers { far: SVGGElement; mid: SVGGElement; ground: SVGGElement }
/** World span of the scene and the x of each chapter in it */
export interface SceneCtx { x0: number; x1: number; chapterX: number[] }
/** An element that rises in when the wolf is within reach. `x` is in its own layer's coordinates. */
export interface Prop { el: SVGGElement; x: number; layer: 0.3 | 0.6 | 1 }
export type DrawScene = (layers: SceneLayers, ctx: SceneCtx) => { props?: Prop[] };

export const GROUND_Y = 300;
const NS = 'http://www.w3.org/2000/svg';

export function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, String(attrs[k]));
  parent?.appendChild(n);
  return n;
}

const placeholder = (name: string): DrawScene => ({ ground }, { x0, x1 }) => {
  el('rect', { x: x0 + 8, y: 40, width: x1 - x0 - 16, height: GROUND_Y - 44, rx: 6, fill: 'none', stroke: 'var(--line)', 'stroke-dasharray': '8 8' }, ground);
  el('text', { x: x0 + 24, y: 70, fill: 'var(--ink-3)', 'font-family': 'JetBrains Mono, monospace', 'font-size': 13 }, ground).textContent = `scene: ${name}`;
  return {};
};

export const SCENES: Record<SceneId, DrawScene> = {
  'fork': placeholder('fork in the trail'),
  'sky': placeholder('night sky, constellations'),
  'radar-ground': placeholder('ground cutaway, radar pulses'),
  'radar-sweep': placeholder('radar sweep'),
  'clouds': placeholder('low clouds in the valley'),
  'avalanche': placeholder('snowy pass, avalanche'),
  'summit': placeholder('summit view'),
  'ridge': placeholder('ridge climb'),
  'overlook': placeholder('the rock over the valley'),
};
