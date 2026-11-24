// Pulley, then Infisical: the ridge climb. A rock wall rises along the trail with a fixed rope on it.
// Pulley's stretch has a hoist with a pulley lifting a crate; Infisical's (secrets management) has a
// vault door set into the rock.
import { el, GROUND_Y, type DrawScene, type Prop } from '../kit';
import { groundBand, seeded, shape, line, type Pt } from './util';

export const drawRidge: DrawScene = ({ ground }, { x0, x1, chapterX }) => {
  const rnd = seeded(2025), props: Prop[] = [], gy = GROUND_Y;
  groundBand(ground, x0, x1, gy, 'var(--stone-d)', 'var(--stone)');

  // The ridge: climbs in steps from the trail on the left to a high crest on the right
  const crest: Pt[] = [];
  for (let x = x0 + 40; x <= x1 - 40; x += 55) { const t = (x - x0) / (x1 - x0); crest.push([x, gy - 30 - t * 150 - rnd() * 26 - (Math.floor(t * 6) % 2) * 14]); }
  shape(ground, [[x0, gy], ...crest, [x1 + 20, gy - 110], [x1 + 90, gy - 40], [x1 + 150, gy]], 'var(--stone-d)');
  for (let i = 0; i < crest.length - 1; i += 2) shape(ground, [crest[i], crest[i + 1], [crest[i + 1][0] + 10, gy], [crest[i][0] + 30, gy]], 'var(--stone)', { opacity: 0.55 });
  for (let i = 3; i < crest.length - 1; i += 3) shape(ground, [crest[i], [crest[i][0] - 14, crest[i][1] + 16], [crest[i][0] + 4, crest[i][1] + 10], [crest[i + 1][0], crest[i + 1][1]]], 'var(--jr-snow)', { opacity: 0.8 });
  // A fixed rope along the foot of the wall, clipped to posts
  const posts: Pt[] = [];
  for (let x = x0 + 60; x < x1 - 30; x += 120) posts.push([x, gy - 34]);
  for (const [x, y] of posts) line(ground, [[x, gy], [x, y]], 'var(--jr-frame)', 2.4);
  el('path', { d: posts.map(([x, y], i) => i ? `Q${x - 60},${y + 12} ${x},${y}` : `M${x},${y}`).join(''), fill: 'none', stroke: 'var(--jr-gpr)', 'stroke-width': 1.6, opacity: 0.9 }, ground);

  // Pulley: an A-frame hoist; the rope runs over the pulley wheel to a crate
  const hoist = el('g', {}, ground), hx = chapterX[0] + 400;
  line(hoist, [[hx - 34, gy], [hx, gy - 124], [hx + 34, gy]], 'var(--jr-wood)', 5);
  line(hoist, [[hx - 20, gy - 50], [hx + 20, gy - 50]], 'var(--jr-wood)', 3.5);
  line(hoist, [[hx, gy - 124], [hx + 58, gy - 136]], 'var(--jr-wood)', 4.5);
  el('circle', { cx: hx + 58, cy: gy - 124, r: 11, fill: 'var(--jr-frame)' }, hoist);
  el('circle', { cx: hx + 58, cy: gy - 124, r: 7, fill: 'none', stroke: 'var(--jr-gpr)', 'stroke-width': 2.4 }, hoist);
  el('circle', { cx: hx + 58, cy: gy - 124, r: 2, fill: 'var(--jr-gpr)' }, hoist);
  line(hoist, [[hx + 69, gy - 124], [hx + 69, gy - 62]], 'var(--jr-target)', 1.3);
  line(hoist, [[hx + 47, gy - 124], [hx - 12, gy - 6]], 'var(--jr-target)', 1.3);
  shape(hoist, [[hx + 54, gy - 62], [hx + 84, gy - 62], [hx + 84, gy - 36], [hx + 54, gy - 36]], 'var(--jr-wood)');
  shape(hoist, [[hx + 70, gy - 62], [hx + 84, gy - 62], [hx + 84, gy - 36], [hx + 70, gy - 36]], 'var(--stone-l)', { opacity: 0.35 });
  line(hoist, [[hx + 54, gy - 62], [hx + 84, gy - 36]], 'var(--jr-frame)', 1.4);
  props.push({ el: hoist, x: hx, layer: 1 });

  // Infisical: a vault door in the rock, light showing through the keyhole
  const vault = el('g', {}, ground), vx = (chapterX[1] ?? chapterX[0]) + 360, vy = gy - 52;
  shape(vault, [[vx - 46, gy], [vx - 46, vy - 30], [vx - 24, vy - 50], [vx + 24, vy - 50], [vx + 46, vy - 30], [vx + 46, gy]], 'var(--jr-frame)');
  el('circle', { cx: vx, cy: vy, r: 34, fill: 'var(--stone)' }, vault);
  el('path', { d: `M${vx},${vy - 34}a34,34 0 0,1 0,68Z`, fill: 'var(--stone-l)' }, vault);
  el('circle', { cx: vx, cy: vy, r: 34, fill: 'none', stroke: 'var(--jr-frame)', 'stroke-width': 3 }, vault);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; el('circle', { cx: vx + 27 * Math.cos(a), cy: vy + 27 * Math.sin(a), r: 2.2, fill: 'var(--jr-frame)' }, vault); }
  el('circle', { cx: vx, cy: vy - 4, r: 6, fill: 'var(--jr-glow)' }, vault);
  shape(vault, [[vx - 3.5, vy - 2], [vx + 3.5, vy - 2], [vx + 6, vy + 14], [vx - 6, vy + 14]], 'var(--jr-glow)');
  props.push({ el: vault, x: vx, layer: 1 });
  return { props };
};
