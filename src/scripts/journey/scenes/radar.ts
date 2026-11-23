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

  // --- The radar cart (a four-wheeled GPR cart): yellow antenna box slung low between big wheels,
  // a dark frame, and a tall handle raked back with the console at the top
  // Permanent scenery, not a prop: it stays put while the wolf runs past
  const cartProp = el('g', {}, ground), cx = x0 + 110, gy = GROUND_Y;
  // Drawn at a nominal size, then scaled up so the handle stands about level with the adult wolf's head
  const cart = el('g', { transform: `translate(${cx},${gy}) scale(1.75) translate(${-cx},${-gy})` }, cartProp);
  const frame = { fill: 'none', stroke: 'var(--jr-frame)', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const wheel = (wx: number, r: number, far: boolean) => {
    el('circle', { cx: wx, cy: gy - r, r, fill: far ? 'var(--jr-frame)' : 'var(--jr-tire)' }, cart);
    if (!far) {
      el('circle', { cx: wx, cy: gy - r, r: r * 0.55, fill: 'none', stroke: 'var(--jr-rimlight)', 'stroke-width': 1.6 }, cart);
      el('circle', { cx: wx, cy: gy - r, r: 2.2, fill: 'var(--jr-rimlight)' }, cart);
    }
  };
  // Far-side wheels peek out behind
  wheel(cx - 24, 11, true); wheel(cx + 22, 11, true);
  // Chassis and the handle: two rails rising back to a crossbar, with the console on top
  el('path', { d: path([[cx - 28, gy - 20], [cx + 26, gy - 20]], false), ...frame }, cart);
  el('path', { d: path([[cx + 14, gy - 22], [cx - 18, gy - 62], [cx - 34, gy - 86]], false), ...frame }, cart);
  el('path', { d: path([[cx + 4, gy - 22], [cx - 24, gy - 58], [cx - 40, gy - 80]], false), ...frame, 'stroke-width': 3, opacity: 0.8 }, cart);
  el('path', { d: path([[cx - 46, gy - 84], [cx - 28, gy - 90]], false), ...frame, 'stroke-width': 5 }, cart);
  el('rect', { x: cx - 30, y: gy - 74, width: 14, height: 9, rx: 1.5, fill: 'var(--jr-frame)', transform: `rotate(-38 ${cx - 23} ${gy - 70})` }, cart);
  el('rect', { x: cx - 48, y: gy - 96, width: 10, height: 7, rx: 3, fill: 'var(--jr-gpr-lit)', transform: `rotate(-20 ${cx - 43} ${gy - 92})` }, cart);
  // The yellow antenna box, with a lit top facet and a small label plate
  el('path', { d: path([[cx - 22, gy - 24], [cx + 20, gy - 24], [cx + 24, gy - 8], [cx - 24, gy - 8]]), fill: 'var(--jr-gpr)' }, cart);
  el('path', { d: path([[cx - 22, gy - 24], [cx + 20, gy - 24], [cx + 21, gy - 20], [cx - 22, gy - 20]]), fill: 'var(--jr-gpr-lit)' }, cart);
  el('rect', { x: cx - 10, y: gy - 19, width: 12, height: 6, rx: 1, fill: 'var(--jr-frame)', opacity: 0.85 }, cart);
  // Near-side wheels in front
  wheel(cx - 26, 12, false); wheel(cx + 24, 12, false);

  // --- Pulses rippling down from the wolf's feet while it crosses the cutaway
  const pulses = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  for (let i = 0; i < 3; i++) el('path', { class: 'jr-pulse', d: 'M-46,3 A46,30 0 0 0 46,3', fill: 'none', stroke: 'var(--jr-pulse)', 'stroke-width': 1.5 }, pulses);

  return { props, follow: [{ el: pulses, x0: x0 + 20, x1: x1 - 20 }] };
};
