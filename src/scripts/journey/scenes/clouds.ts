// Stratoscale: a private cloud, the kind a company runs on its own hardware. Low cloud fills the
// valley, and a small server hut on the trail keeps a cloud of its own on a tether.
import { el, GROUND_Y, layerX, type DrawScene, type Prop } from '../kit';
import { cloud, seeded, shape, line } from './util';

export const drawClouds: DrawScene = ({ mid, ground }, { x0, x1 }) => {
  const rnd = seeded(1911), props: Prop[] = [], gy = GROUND_Y;
  // Cloud lying in the valley behind, and a few banks drifting low over the trail
  for (let x = x0 - 60; x < x1; x += 120 + rnd() * 90) cloud(mid, layerX(x, 0.6), 246 + rnd() * 8, 90 + rnd() * 70, 26 + rnd() * 16, 0.55);
  for (let x = x0 + 20; x < x1 - 120; x += 170 + rnd() * 80) cloud(ground, x, 150 + rnd() * 60, 110 + rnd() * 60, 30 + rnd() * 14, 0.8);

  // The server hut: racks with status lights, and its own cloud held on a line
  const hut = el('g', {}, ground), hx = x0 + 380;
  shape(hut, [[hx - 34, gy], [hx - 34, gy - 46], [hx + 34, gy - 46], [hx + 34, gy]], 'var(--stone-d)');
  shape(hut, [[hx + 6, gy], [hx + 6, gy - 46], [hx + 34, gy - 46], [hx + 34, gy]], 'var(--stone)');
  shape(hut, [[hx - 40, gy - 44], [hx - 30, gy - 56], [hx + 38, gy - 56], [hx + 40, gy - 44]], 'var(--jr-frame)');
  for (let r = 0; r < 4; r++) {
    el('rect', { x: hx - 28, y: gy - 40 + r * 9, width: 28, height: 6, rx: 1, fill: 'var(--jr-frame)' }, hut);
    for (let c = 0; c < 3; c++) el('circle', { cx: hx - 23 + c * 6, cy: gy - 37 + r * 9, r: 1.3, fill: (r + c) % 3 ? 'var(--jr-pulse)' : 'var(--jr-glow)' }, hut);
  }
  props.push({ el: hut, x: hx, layer: 1 });
  const own = el('g', {}, ground);
  line(own, [[hx + 20, gy - 56], [hx + 34, gy - 112]], 'var(--jr-target)', 1.2, { opacity: 0.7 });
  cloud(own, hx - 30, gy - 110, 120, 40);
  props.push({ el: own, x: hx, layer: 1 });
  return { props };
};
