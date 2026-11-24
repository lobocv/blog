// One draw function per scene. Each draws into the shared layers over its own world span.
// The two scenes that have no chapter yet (fork, overlook) are labelled placeholders.
import type { SceneId } from '../../data/timeline';
import { drawAvalanche } from './scenes/avalanche';
import { drawClouds } from './scenes/clouds';
import { drawRadar } from './scenes/radar';
import { drawRidge } from './scenes/ridge';
import { drawSky } from './scenes/sky';
import { drawSummit } from './scenes/summit';
import { drawSweep } from './scenes/sweep';

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
  'sky': drawSky,
  'radar-ground': drawRadar,
  'radar-sweep': drawSweep,
  'clouds': drawClouds,
  'avalanche': drawAvalanche,
  'summit': drawSummit,
  'ridge': drawRidge,
  'overlook': placeholder('the rock over the valley'),
};
