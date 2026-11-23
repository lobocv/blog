// One draw function per scene. Each draws into the shared layers over its own world span.
// Every scene but the radar one is a labelled placeholder until its art is drawn.
import type { SceneId } from '../../data/timeline';
import { drawRadar } from './scenes/radar';

export type { DrawScene, Follow, Prop, SceneCtx, SceneLayers } from './kit';
export { el, GROUND_Y } from './kit';
import { el, GROUND_Y, type DrawScene } from './kit';

const placeholder = (name: string): DrawScene => ({ ground }, { x0, x1 }) => {
  el('rect', { x: x0 + 8, y: 40, width: x1 - x0 - 16, height: GROUND_Y - 44, rx: 6, fill: 'none', stroke: 'var(--line)', 'stroke-dasharray': '8 8' }, ground);
  el('text', { x: x0 + 24, y: 70, fill: 'var(--ink-3)', 'font-family': 'JetBrains Mono, monospace', 'font-size': 13 }, ground).textContent = `scene: ${name}`;
  return {};
};

export const SCENES: Record<SceneId, DrawScene> = {
  'fork': placeholder('fork in the trail'),
  'sky': placeholder('night sky, constellations'),
  'radar-ground': drawRadar,
  'radar-sweep': placeholder('radar sweep'),
  'clouds': placeholder('low clouds in the valley'),
  'avalanche': placeholder('snowy pass, avalanche'),
  'summit': placeholder('summit view'),
  'ridge': placeholder('ridge climb'),
  'overlook': placeholder('the rock over the valley'),
};
