// Patriot One: radar that looks for concealed weapons. A radar scope rises behind the trail like a
// moon, its beam sweeping while the wolf moves, and the wolf runs through a detection gate.
import { el, GROUND_Y, type DrawScene, type Prop } from '../kit';
import { shape, line } from './util';

export const drawSweep: DrawScene = ({ ground }, { x0 }) => {
  const props: Prop[] = [], gy = GROUND_Y;

  // The scope: half a radar screen above the horizon, with range rings and a sweeping beam
  const scope = el('g', {}, ground), cx = x0 + 360, R = 170;
  el('path', { d: `M${cx - R},${gy}a${R},${R} 0 0,1 ${R * 2},0Z`, fill: 'var(--jr-pulse)', opacity: 0.07 }, scope);
  for (const r of [R, R * 0.66, R * 0.33]) el('path', { d: `M${cx - r},${gy}a${r},${r} 0 0,1 ${r * 2},0`, fill: 'none', stroke: 'var(--jr-pulse)', 'stroke-width': 1.2, opacity: 0.45 }, scope);
  for (const a of [30, 60, 90, 120, 150]) { const t = a * Math.PI / 180; line(scope, [[cx, gy], [cx - R * Math.cos(t), gy - R * Math.sin(t)]], 'var(--jr-pulse)', 0.8, { opacity: 0.25 }); }
  // The beam: a wedge whose bottom-left corner is the pivot, so CSS can swing it about that corner
  const t = 16 * Math.PI / 180;
  el('path', { class: 'jr-sweep', d: `M${cx},${gy}L${cx + R},${gy}A${R},${R} 0 0,0 ${cx + R * Math.cos(t)},${gy - R * Math.sin(t)}Z`, fill: 'var(--jr-pulse)', opacity: 0.3 }, scope);
  // Things the radar has picked up
  for (const [a, r] of [[40, 0.5], [75, 0.8], [118, 0.6], [150, 0.86]] as const) {
    const blip = el('g', {}, ground), b = a * Math.PI / 180, bx = cx - R * r * Math.cos(b), by = gy - R * r * Math.sin(b);
    el('circle', { cx: bx, cy: by, r: 3.2, fill: 'var(--jr-target)' }, blip);
    el('circle', { cx: bx, cy: by, r: 8, fill: 'none', stroke: 'var(--jr-target)', 'stroke-width': 1, opacity: 0.5 }, blip);
    props.push({ el: blip, x: bx, layer: 1 });
  }

  // The gate: two sensor posts the wolf passes between, with the waves between them drawing in
  const gate = (x: number) => {
    shape(ground, [[x - 5, gy], [x - 4, gy - 120], [x + 4, gy - 120], [x + 5, gy]], 'var(--jr-frame)');
    shape(ground, [[x, gy], [x, gy - 120], [x + 4, gy - 120], [x + 5, gy]], 'var(--stone)');
    for (const y of [30, 60, 90]) el('rect', { x: x - 6, y: gy - y - 5, width: 12, height: 10, rx: 2, fill: 'var(--jr-gpr)' }, ground);
    shape(ground, [[x - 12, gy], [x - 8, gy - 8], [x + 8, gy - 8], [x + 12, gy]], 'var(--jr-frame)');
  };
  const gx = x0 + 520, gap = 150;
  gate(gx); gate(gx + gap);
  const waves = el('g', {}, ground);
  for (const y of [30, 60, 90]) for (const k of [1, 2, 3]) {
    const r = k * 24, yy = gy - y;
    el('path', { d: `M${gx + 8 + r * 0.5},${yy - r * 0.8}A${r},${r} 0 0,1 ${gx + 8 + r * 0.5},${yy + r * 0.8}`, fill: 'none', stroke: 'var(--jr-pulse)', 'stroke-width': 1.3, opacity: 0.85 - k * 0.2, pathLength: 1 }, waves);
  }
  props.push({ el: waves, x: gx - 40, layer: 1, kind: 'draw' });
  return { props };
};
