// The journey wolf, side-on and running right, in the hero wolf's faceted style: a dark base,
// a few flat facets lit from the upper right, and a rim light along the back.
// One parametric drawing grows through four ages; ground is y = 0, the body centre is x = 0.
// Legs have two jointed segments driven by a gallop cycle (see GAIT).
const NS = 'http://www.w3.org/2000/svg';

interface Leg { upper: SVGGElement; lower: SVGGElement; hind: boolean; offset: number }
interface AgeRig { g: SVGGElement; legs: Leg[]; torso: SVGGElement; head: SVGGElement; tail: SVGGElement; neck: Pt; rump: Pt }
export interface Wolf { ages: AgeRig[]; body: SVGGElement }

interface Build {
  /** torso length and depth */ len: number; depth: number;
  /** leg length (ground to belly) and thickness */ leg: number; thick: number;
  /** head size, muzzle length, ear size */ head: number; muzzle: number; ear: number;
  /** mane at the neck (0 to 1), tail length */ ruff: number; tail: number;
  paw: number; grey: boolean;
}
const BUILDS: Build[] = [
  { len: 64, depth: 34, leg: 22, thick: 11, head: 1.25, muzzle: 0.6, ear: 1.25, ruff: 0, tail: 0.55, paw: 1.5, grey: false },  // pup
  { len: 98, depth: 38, leg: 36, thick: 10, head: 1.05, muzzle: 0.9, ear: 1.1, ruff: 0.3, tail: 0.85, paw: 1.1, grey: false }, // yearling
  { len: 116, depth: 48, leg: 35, thick: 12.5, head: 1.15, muzzle: 1, ear: 1, ruff: 1, tail: 1, paw: 1.05, grey: false },      // adult
  { len: 116, depth: 48, leg: 35, thick: 12.5, head: 1.15, muzzle: 1, ear: 1, ruff: 1, tail: 1, paw: 1.05, grey: true },       // grey muzzle
];

/**
 * A rotary gallop, as [phase, upper angle, lower angle] keyframes per leg type. Angles are degrees;
 * positive swings the foot backward (the wolf faces right). Front legs fold at the wrist on the way
 * forward; hind legs fold at the hock and reach under the body.
 */
type Key = [number, number, number];
const GAIT: Record<'front' | 'hind', Key[]> = {
  front: [[0, -38, 0], [0.38, 32, 8], [0.52, 30, 88], [0.78, -26, 46], [1, -38, 0]],
  hind: [[0, -30, 4], [0.36, 34, 2], [0.5, 42, -40], [0.78, -6, -72], [1, -30, 4]],
};
/**
 * When each leg's cycle starts, in a gallop's footfall order (back-far, back-near, front-near, front-far).
 * Each pair is split by a quarter stride so the near and far legs read as two legs, not one.
 */
const OFFSETS = { hindFar: 0, hindNear: 0.24, frontNear: 0.5, frontFar: 0.74 };
/** Head angle (degrees, positive is nose down) when standing and the extra drop at full gallop */
const HEAD_REST = 10, HEAD_RUN = 16;

type Pt = [number, number];
const d = (pts: Pt[]) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z';
const open = (pts: Pt[]) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L');

function svg(tag: string, attrs: Record<string, string | number>, parent: Element): SVGElement {
  const n = document.createElementNS(NS, tag) as SVGElement;
  for (const k in attrs) n.setAttribute(k, String(attrs[k]));
  parent.appendChild(n);
  return n;
}
const group = (parent: Element, attrs: Record<string, string | number> = {}) => svg('g', attrs, parent) as SVGGElement;

/** Two-segment leg hanging from the hip. The lower group pivots at the knee (front) or hock (hind). */
function drawLeg(parent: SVGGElement, hip: Pt, b: Build, hind: boolean, fill: string, offset: number): Leg {
  const len = -hip[1], w = b.thick, p = 5 * b.paw;
  const up = hind ? len * 0.5 : len * 0.48, low = len - up;
  const root = group(parent, { transform: `translate(${hip[0]},${hip[1]})` });
  const upper = group(root);
  svg('path', { d: hind
    ? d([[-w * 1.05, -8], [w * 0.85, -8], [w * 0.45, up], [-w * 0.45, up]])
    : d([[-w * 0.6, -6], [w * 0.6, -6], [w * 0.38, up], [-w * 0.4, up]]), fill }, upper);
  const knee = group(upper, { transform: `translate(0,${up})` });
  svg('circle', { r: w * 0.43, fill }, knee);
  const lower = group(knee);
  svg('path', { d: d([[-w * 0.4, 0], [w * 0.4, 0], [w * 0.3, low - p], [w * 0.3 + p * 1.3, low - p * 0.3], [w * 0.3 + p * 1.1, low], [-w * 0.4, low], [-w * 0.42, low - p]]), fill }, lower);
  return { upper, lower, hind, offset };
}

function drawAge(b: Build, parent: SVGGElement): AgeRig {
  const { len: L, depth: H, leg } = b;
  const top = -(leg + H), belly = -leg;
  const hipF: Pt = [L / 2 - 14, belly - 6], hipB: Pt = [-L / 2 + 14, belly - 8];
  const legs: Leg[] = [];
  // Far legs sit behind the body in the darkest tone
  legs.push(drawLeg(parent, [hipF[0] + 6, hipF[1]], b, false, 'var(--jr-wolf-1)', OFFSETS.frontFar));
  legs.push(drawLeg(parent, [hipB[0] + 6, hipB[1]], b, true, 'var(--jr-wolf-1)', OFFSETS.hindFar));

  const torso = group(parent);
  // Tail, sweeping back and down from the rump; it pivots at the rump
  const t = b.tail, rx = -L / 2;
  const rumpPivot: Pt = [rx + 2, top + H * 0.3];
  const tail = group(torso);
  svg('path', { d: d([[rx + 2, top + H * 0.12], [rx - 26 * t, top + H * 0.2], [rx - 50 * t, top + H * 0.55], [rx - 38 * t, top + H * 0.62], [rx - 22 * t, top + H * 0.48], [rx - 2, top + H * 0.5]]), fill: 'var(--jr-wolf-2)' }, tail);
  svg('path', { d: d([[rx + 2, top + H * 0.12], [rx - 26 * t, top + H * 0.2], [rx - 50 * t, top + H * 0.55], [rx - 24 * t, top + H * 0.34]]), fill: 'var(--jr-wolf-3)' }, tail);

  // Torso: base, then facets
  const rump: Pt = [rx - 4, top + H * 0.45], rumpTop: Pt = [rx + 4, top + 3], back: Pt = [0, top + 2], wither: Pt = [L / 2 - 8, top - 2];
  const chest: Pt = [L / 2 + 10, top + H * 0.5], chestLow: Pt = [L / 2 - 2, belly + 2], tuck: Pt = [-L * 0.1, belly - H * 0.12], haunch: Pt = [rx + 8, belly];
  svg('path', { d: d([rumpTop, back, wither, chest, chestLow, tuck, haunch, rump]), fill: 'var(--jr-wolf-2)' }, torso);
  const mid: Pt = [L * 0.05, top + H * 0.5];
  svg('path', { d: d([rumpTop, back, wither, [L / 2 - 4, top + H * 0.35], mid, [rx + 4, top + H * 0.4]]), fill: 'var(--jr-wolf-3)' }, torso);
  svg('path', { d: d([back, wither, [L * 0.25, top + H * 0.3]]), fill: 'var(--jr-wolf-4)' }, torso);
  svg('path', { d: d([wither, chest, chestLow, [L * 0.28, top + H * 0.55]]), fill: 'var(--jr-wolf-3)' }, torso);
  svg('path', { d: d([[rx + 4, top + H * 0.4], mid, tuck, haunch, rump]), fill: 'var(--jr-wolf-1)', opacity: 0.55 }, torso);
  svg('path', { d: open([rumpTop, back]), fill: 'none', stroke: 'var(--jr-rim)', 'stroke-width': 1.8, 'stroke-linejoin': 'round', opacity: 0.75 }, torso);

  // Neck: a solid wedge from the withers and chest up into the head, so the head can tilt without
  // opening a gap. Adults carry a soft ruff along its back edge.
  const hx = L / 2 + 2, hy = top + 6, s = b.head, r = b.ruff;
  const nape: Pt = [hx - 4 * s, hy - 15 * s], throat: Pt = [hx + 14 * s, hy + 14 * s];
  svg('path', { d: d([[wither[0] - 18, top + 4], [wither[0] - 10 - 4 * r, top - 4 - 3 * r], nape, [hx + 10 * s, hy - 6 * s], throat, chest, [L / 2 - 6, top + H * 0.45]]), fill: 'var(--jr-wolf-2)' }, torso);
  svg('path', { d: d([[wither[0] - 10 - 4 * r, top - 4 - 3 * r], nape, [hx + 6 * s, hy + 2 * s], [L / 2 - 4, top + H * 0.3]]), fill: 'var(--jr-wolf-3)' }, torso);
  svg('path', { d: open([back, [wither[0] - 10 - 4 * r, top - 4 - 3 * r], nape]), fill: 'none', stroke: 'var(--jr-rim)', 'stroke-width': 1.8, 'stroke-linejoin': 'round', opacity: 0.75 }, torso);

  // Head, in its own group so it can tilt about the neck
  const neck: Pt = [hx - 6, hy + 6];
  const head = group(torso);
  const m = b.muzzle, e = b.ear;
  const H_: Pt[] = [[-10, 10], [-9, -4], [-4, -14], [-2, -16], [10, -20], [18, -19], [18 + 16 * m, -12], [18 + 22 * m, -8], [18 + 19 * m, -2], [16 + 8 * m, 2], [14, 12], [6, 22]];
  const at = (p: Pt): Pt => [hx + p[0] * s, hy + p[1] * s];
  svg('path', { d: d(H_.map(at)), fill: 'var(--jr-wolf-2)' }, head);
  svg('path', { d: d(([[-2, -16], [10, -20], [18, -19], [18 + 16 * m, -12], [14, -7], [2, -6]] as Pt[]).map(at)), fill: 'var(--jr-wolf-4)' }, head);
  svg('path', { d: d(([[18 + 16 * m, -12], [18 + 22 * m, -8], [18 + 19 * m, -2], [16 + 8 * m, 2], [14, -7]] as Pt[]).map(at)), fill: b.grey ? 'var(--jr-muzzle)' : 'var(--jr-wolf-3)' }, head);
  if (b.grey) svg('path', { d: d(([[6, 22], [14, 12], [16, 4], [8, 8]] as Pt[]).map(at)), fill: 'var(--jr-muzzle)', opacity: 0.7 }, head);
  // Ears laid slightly back, as when running
  svg('path', { d: d(([[0, -16], [-2 * e, -33 * e], [12, -19]] as Pt[]).map(at)), fill: 'var(--jr-wolf-3)' }, head);
  svg('path', { d: d(([[3, -18], [0, -28 * e], [9, -19]] as Pt[]).map(at)), fill: 'var(--jr-wolf-4)' }, head);
  const [ex, ey] = at([17, -12]);
  svg('circle', { cx: ex, cy: ey, r: 1.6 * s, fill: 'var(--jr-rim)', opacity: 0.85 }, head);
  svg('path', { d: open([at([-4, -15]), at([-2, -16]), at([-2 * e, -33 * e]), at([12, -19]), at([18, -19]), at([18 + 16 * m, -12]), at([18 + 22 * m, -8])]), fill: 'none', stroke: 'var(--jr-rim)', 'stroke-width': 1.8, 'stroke-linejoin': 'round', opacity: 0.75 }, head);

  // Near legs in front of the body
  legs.push(drawLeg(parent, hipF, b, false, 'var(--jr-wolf-2)', OFFSETS.frontNear));
  legs.push(drawLeg(parent, hipB, b, true, 'var(--jr-wolf-2)', OFFSETS.hindNear));
  return { g: parent, legs, torso, head, tail, neck, rump: rumpPivot };
}

export function drawWolf(parent: SVGGElement): Wolf {
  const body = group(parent);
  const ages = BUILDS.map((b, i) => drawAge(b, group(body, { opacity: i === 0 ? 1 : 0 })));
  return { ages, body };
}

/** Upper and lower leg angles at a point in the cycle, eased between keyframes */
export function gaitAngles(keys: Key[], t: number): [number, number] {
  t = ((t % 1) + 1) % 1;
  let i = 0; while (i < keys.length - 2 && t >= keys[i + 1][0]) i++;
  const [t0, u0, l0] = keys[i], [t1, u1, l1] = keys[i + 1];
  const f = (1 - Math.cos(Math.PI * (t - t0) / (t1 - t0))) / 2;
  return [u0 + (u1 - u0) * f, l0 + (l1 - l0) * f];
}

/**
 * Pose for one frame. `cycle` is the stride position (1 = one full stride; it runs backwards on rewind),
 * `gait` blends from standing (0) to a full gallop (1), and `age` is fractional while cross-fading.
 */
export function poseWolf(w: Wolf, cycle: number, gait: number, age: number): void {
  const lo = Math.floor(age), hi = Math.min(3, lo + 1), f = age - lo;
  const wave = Math.sin(cycle * Math.PI * 2);
  w.ages.forEach((rig, i) => {
    const op = i === lo ? 1 - f : i === hi ? f : 0;
    rig.g.setAttribute('opacity', String(op));
    if (op === 0) return;
    for (const l of rig.legs) {
      const [u, lw] = gaitAngles(l.hind ? GAIT.hind : GAIT.front, cycle + l.offset);
      l.upper.setAttribute('transform', `rotate(${(u * gait).toFixed(1)})`);
      l.lower.setAttribute('transform', `rotate(${(lw * gait).toFixed(1)})`);
    }
    // The spine rocks with the stride; the head dips and the tail streams out behind
    const pitch = wave * 3 * gait;
    rig.torso.setAttribute('transform', `rotate(${pitch.toFixed(2)})`);
    rig.head.setAttribute('transform', `rotate(${(HEAD_REST + HEAD_RUN * gait - pitch * 1.5).toFixed(1)},${rig.neck[0]},${rig.neck[1]})`);
    rig.tail.setAttribute('transform', `rotate(${(-14 * gait + wave * 6 * gait).toFixed(1)},${rig.rump[0]},${rig.rump[1]})`);
  });
  // Lowest when the legs gather under the body, highest in the stretch after push-off
  w.body.setAttribute('transform', `translate(0,${(-5 * gait * (1 + Math.cos(cycle * Math.PI * 4)) / 2).toFixed(1)})`);
}
