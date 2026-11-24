// McMaster: physics. A night sky whose constellations draw in as the wolf passes under them.
// One is an atom with its electron orbits, the other is the Earth's magnetic field facing the Sun
// (the two things the co-op terms were about). An observatory sits on the trail.
import { el, GROUND_Y, layerX, type DrawScene, type Prop } from '../kit';
import { seeded, shape, line } from './util';

const INK = 'var(--jr-sky-ink)';

export const drawSky: DrawScene = ({ mid, ground }, { x0, x1 }) => {
  const rnd = seeded(808), props: Prop[] = [];
  for (let i = 0; i < 80; i++)
    el('circle', { cx: layerX(x0 - 150 + rnd() * (x1 - x0 + 300), 0.6), cy: 60 + rnd() * 130, r: 0.6 + rnd() * 1.2, fill: INK, opacity: 0.3 + rnd() * 0.6 }, mid);

  const stroke = { fill: 'none', stroke: INK, 'stroke-width': 1.2, 'stroke-linecap': 'round', pathLength: 1, opacity: 0.8 };
  const star = (g: Element, x: number, y: number, r = 2) => el('circle', { cx: x, cy: y, r, fill: INK }, g);
  const constellation = (worldX: number, draw: (g: SVGGElement, cx: number) => void) => {
    const g = el('g', {}, mid), cx = layerX(worldX, 0.6);
    draw(g, cx);
    props.push({ el: g, x: cx - 30, layer: 0.6, kind: 'draw' });
  };

  // An atom: three electron orbits around a nucleus
  constellation(x0 + 130, (g, cx) => {
    const cy = 124;
    for (const a of [0, 60, 120]) {
      el('path', { d: `M${cx - 44},${cy}a44,14 0 1,0 88,0a44,14 0 1,0 -88,0`, transform: `rotate(${a} ${cx} ${cy})`, ...stroke }, g);
      const t = (a + 25) * Math.PI / 180;
      star(g, cx + 44 * Math.cos(t) * Math.cos(a * Math.PI / 180) - 14 * Math.sin(t) * Math.sin(a * Math.PI / 180), cy + 44 * Math.cos(t) * Math.sin(a * Math.PI / 180) + 14 * Math.sin(t) * Math.cos(a * Math.PI / 180), 2.2);
    }
    star(g, cx, cy, 3.2);
  });

  // The Earth's magnetic field: squashed on the side facing the Sun, stretched into a tail behind
  constellation(x0 + 640, (g, cx) => {
    const cy = 128, sx = cx - 118;
    el('circle', { cx: sx, cy, r: 9, fill: 'var(--jr-glow)', opacity: 0.9 }, g);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; line(g, [[sx + 13 * Math.cos(a), cy + 13 * Math.sin(a)], [sx + 19 * Math.cos(a), cy + 19 * Math.sin(a)]], 'var(--jr-glow)', 1.4, { pathLength: 1 }); }
    for (const s of [1, 1.7, 2.5]) {
      el('path', { d: `M${cx},${cy - 6}C${cx + 44 * s},${cy - 34 * s} ${cx + 44 * s},${cy + 34 * s} ${cx},${cy + 6}`, ...stroke }, g);
      el('path', { d: `M${cx},${cy - 6}C${cx - 22 * s},${cy - 26 * s} ${cx - 22 * s},${cy + 26 * s} ${cx},${cy + 6}`, ...stroke }, g);
    }
    // The solar wind arriving from the Sun
    for (const dy of [-22, 0, 22]) line(g, [[sx + 26, cy + dy], [cx - 66, cy + dy * 1.5]], INK, 1, { pathLength: 1, opacity: 0.5, 'stroke-dasharray': '0.08 0.06' });
    star(g, cx, cy, 5);
  });

  // An observatory on the trail, its dome open to the sky
  const obs = el('g', {}, ground), ox = x0 + 400, gy = GROUND_Y;
  shape(obs, [[ox - 70, gy], [ox - 30, gy - 16], [ox + 40, gy - 16], [ox + 80, gy]], 'var(--stone-d)');
  shape(obs, [[ox - 22, gy - 16], [ox - 22, gy - 44], [ox + 22, gy - 44], [ox + 22, gy - 16]], 'var(--stone)');
  shape(obs, [[ox, gy - 44], [ox + 22, gy - 44], [ox + 22, gy - 16], [ox, gy - 16]], 'var(--stone-l)');
  el('path', { d: `M${ox - 24},${gy - 44}a24,24 0 0,1 48,0Z`, fill: 'var(--stone)' }, obs);
  el('path', { d: `M${ox},${gy - 68}a24,24 0 0,1 24,24L${ox},${gy - 44}Z`, fill: 'var(--stone-l)' }, obs);
  shape(obs, [[ox - 4, gy - 44], [ox + 2, gy - 67], [ox + 9, gy - 65], [ox + 6, gy - 44]], 'var(--jr-frame)');
  line(obs, [[ox + 2, gy - 52], [ox + 22, gy - 82]], 'var(--stone-l)', 4);
  el('rect', { x: ox - 5, y: gy - 30, width: 10, height: 14, fill: 'var(--jr-glow)', opacity: 0.8 }, obs);
  props.push({ el: obs, x: ox, layer: 1 });
  return { props };
};
