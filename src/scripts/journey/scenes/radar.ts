// Sensors & Software: ground penetrating radar. The ground opens into a cutaway of soil layers
// with things buried in it. Radar pulses ripple down from the wolf's feet, and as it passes over
// each buried object, the hyperbola it makes in radar data (the classic GPR signature) draws in.
import { el, GROUND_Y, layerX, type DrawScene, type Prop } from '../kit';

type Pt = [number, number];
const path = (pts: Pt[], close = true) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + (close ? 'Z' : '');

/** Strata boundaries, as depths below the ground line */
const STRATA = [18, 46, 80];
const BOTTOM = GROUND_Y + 130;

export const drawRadar: DrawScene = ({ mid, ground }, { x0, x1 }) => {
  let seed = 4127;
  const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const props: Prop[] = [];

  // --- Pines on the mid hills, in the site's two-tone style (dark left, lit right)
  for (let x = x0 + 40; x < x1; x += 90 + rng() * 120) {
    const px = layerX(x, 0.6), py = 248 + rng() * 10, h = 34 + rng() * 26, w = h * 0.34;
    const g = el('g', {}, mid);
    el('path', { d: path([[px, py - h], [px - w, py], [px + w, py]]), fill: 'var(--tree)' }, g);
    el('path', { d: path([[px, py - h], [px + w, py], [px + w * 0.1, py]]), fill: 'var(--tree-lit)' }, g);
  }

  // --- The cutaway: soil layers whose ends are bevelled like a cut through the ground
  const cut = el('g', {}, ground);
  const edge = (y: number) => {
    const pts: Pt[] = [];
    for (let x = x0; x <= x1; x += 35) pts.push([x, y + (rng() - 0.5) * 6]);
    pts.push([x1, y]);
    return pts;
  };
  const lines = [edge(GROUND_Y + 4), ...STRATA.map(dy => edge(GROUND_Y + dy)), edge(BOTTOM)];
  const bevel = 34;
  for (let k = 0; k < lines.length - 1; k++) {
    const top = lines[k], bot = lines[k + 1];
    // Narrow the band at both ends so the cut slopes in from the surface
    const inset = (pts: Pt[], depth: number): Pt[] => pts.map(([x, y]) => [Math.min(Math.max(x, x0 + bevel * depth), x1 - bevel * depth), y]);
    const tDepth = k / (lines.length - 1), bDepth = (k + 1) / (lines.length - 1);
    el('path', { d: path([...inset(top, tDepth), ...inset(bot, bDepth).reverse()]), fill: `var(--jr-soil-${k + 1})` }, cut);
  }
  // Bevelled faces at each end catch a little light on the right
  el('path', { d: path([[x0, GROUND_Y + 4], [x0 + bevel, BOTTOM], [x0, BOTTOM]]), fill: 'var(--soil)' }, cut);
  el('path', { d: path([[x1, GROUND_Y + 4], [x1 - bevel, BOTTOM], [x1, BOTTOM]]), fill: 'var(--soil-2)' }, cut);
  el('path', { d: path([[x0, GROUND_Y + 4], [x1, GROUND_Y + 4]], false), stroke: 'var(--jr-target)', 'stroke-width': 1, opacity: 0.35 }, cut);

  // --- Buried things, each with its radar hyperbola
  const targets: { x: number; y: number; draw: (g: SVGGElement) => void }[] = [
    { x: x0 + 160, y: GROUND_Y + 30, draw: g => {   // a row of rebar
      for (let i = -1; i <= 1; i++) el('circle', { cx: x0 + 160 + i * 9, cy: GROUND_Y + 30, r: 2.6, fill: 'var(--jr-target)' }, g);
    } },
    { x: x0 + 350, y: GROUND_Y + 60, draw: g => {   // a pipe, end-on
      el('circle', { cx: x0 + 350, cy: GROUND_Y + 60, r: 7, fill: 'none', stroke: 'var(--jr-target)', 'stroke-width': 2.4 }, g);
    } },
    { x: x0 + 540, y: GROUND_Y + 86, draw: g => {   // a boulder
      const cx = x0 + 540, cy = GROUND_Y + 86;
      el('path', { d: path([[cx - 16, cy + 4], [cx - 10, cy - 8], [cx + 4, cy - 11], [cx + 15, cy - 3], [cx + 12, cy + 8], [cx - 6, cy + 10]]), fill: 'var(--jr-target)', opacity: 0.8 }, g);
    } },
  ];
  for (const t of targets) {
    t.draw(el('g', {}, ground));
    const hyp = el('g', {}, ground);
    // Three echoes, fainter with each ring, opening downward from just above the object
    for (let i = 0; i < 3; i++) {
      const apex = t.y - 9 + i * 7, a = 16, pts: Pt[] = [];
      for (let dx = -68; dx <= 68; dx += 4) pts.push([t.x + dx, Math.min(BOTTOM - 4, apex + (Math.sqrt(a * a + dx * dx) - a) * 0.55)]);
      el('path', { d: path(pts, false), fill: 'none', stroke: 'var(--jr-pulse)', 'stroke-width': 1.6 - i * 0.3, opacity: 0.9 - i * 0.28, pathLength: 1 }, hyp);
    }
    props.push({ el: hyp, x: t.x, layer: 1, kind: 'draw' });
  }

  // --- The radar cart, parked on the surface where the scene starts
  const cart = el('g', {}, ground), cx = x0 + 70;
  el('path', { d: path([[cx - 26, GROUND_Y - 34], [cx - 12, GROUND_Y - 12]], false), stroke: 'var(--stone-l)', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, cart);
  el('rect', { x: cx - 14, y: GROUND_Y - 16, width: 30, height: 10, rx: 2, fill: 'var(--stone)' }, cart);
  el('rect', { x: cx - 14, y: GROUND_Y - 16, width: 30, height: 3, fill: 'var(--stone-l)' }, cart);
  for (const wx of [cx - 9, cx + 11]) el('circle', { cx: wx, cy: GROUND_Y - 4, r: 4.5, fill: 'var(--stone-d)', stroke: 'var(--stone-l)', 'stroke-width': 1 }, cart);
  props.push({ el: cart, x: cx, layer: 1 });

  // --- Pulses rippling down from the wolf's feet while it crosses the cutaway
  const pulses = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  for (let i = 0; i < 3; i++) el('path', { class: 'jr-pulse', d: 'M-46,3 A46,30 0 0 0 46,3', fill: 'none', stroke: 'var(--jr-pulse)', 'stroke-width': 1.5 }, pulses);

  return { props, follow: [{ el: pulses, x0: x0 + 20, x1: x1 - 20 }] };
};
