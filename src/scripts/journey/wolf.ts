// The journey wolf, side-on and running right, in the hero wolf's faceted style: a dark base,
// a few flat facets lit from the upper right, and a rim light along the back.
// One parametric drawing grows through four ages; ground is y = 0, the body centre is x = 0.
const NS = 'http://www.w3.org/2000/svg';

export interface Wolf { ages: SVGGElement[]; legs: SVGGElement[]; body: SVGGElement }

interface Build {
  /** torso length and depth */ len: number; depth: number;
  /** leg length (ground to belly) and thickness */ leg: number; thick: number;
  /** head size, muzzle length, ear size */ head: number; muzzle: number; ear: number;
  /** mane at the neck (0 to 1), tail length */ ruff: number; tail: number;
  paw: number; grey: boolean;
}
const BUILDS: Build[] = [
  { len: 64, depth: 34, leg: 22, thick: 11, head: 1.25, muzzle: 0.6, ear: 1.25, ruff: 0, tail: 0.55, paw: 1.5, grey: false },  // pup
  { len: 96, depth: 33, leg: 42, thick: 9, head: 1.0, muzzle: 0.9, ear: 1.1, ruff: 0.3, tail: 0.85, paw: 1.1, grey: false },   // yearling
  { len: 110, depth: 42, leg: 40, thick: 11, head: 1.05, muzzle: 1, ear: 1, ruff: 1, tail: 1, paw: 1, grey: false },            // adult
  { len: 110, depth: 42, leg: 40, thick: 11, head: 1.05, muzzle: 1, ear: 1, ruff: 1, tail: 1, paw: 1, grey: true },             // grey muzzle
];

type Pt = [number, number];
const d = (pts: Pt[]) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z';
const open = (pts: Pt[]) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L');

function svg(tag: string, attrs: Record<string, string | number>, parent: Element): SVGElement {
  const n = document.createElementNS(NS, tag) as SVGElement;
  for (const k in attrs) n.setAttribute(k, String(attrs[k]));
  parent.appendChild(n);
  return n;
}

/** One leg hanging from the hip at (0, 0), reaching `len` down, paw forward. Hind legs get a thigh and a hock. */
function legPath(len: number, w: number, paw: number, hind: boolean): string {
  const p = 5 * paw;
  const foot: Pt[] = [[w * 0.32 + p * 1.3, len - p * 0.3], [w * 0.32 + p * 1.1, len], [-w * 0.4, len], [-w * 0.42, len - p]];
  if (hind) return d([[-w * 0.95, -6], [w * 0.75, -6], [w * 0.6, len * 0.36], [w * 0.18, len * 0.68], [w * 0.3, len - p], ...foot, [-w * 0.6, len * 0.66], [-w * 0.9, len * 0.3]]);
  return d([[-w * 0.55, -4], [w * 0.55, -4], [w * 0.34, len * 0.7], [w * 0.36, len - p], ...foot, [-w * 0.36, len * 0.72], [-w * 0.48, len * 0.3]]);
}

function drawAge(b: Build, parent: SVGGElement): SVGGElement[] {
  const { len: L, depth: H, leg } = b;
  const top = -(leg + H), belly = -leg;
  const hipF: Pt = [L / 2 - 14, belly - 6], hipB: Pt = [-L / 2 + 14, belly - 8];
  const legs: SVGGElement[] = [];
  const addLeg = (hip: Pt, fill: string, hind: boolean) => {
    const g = svg('g', { transform: `translate(${hip[0]},${hip[1]})` }, parent) as SVGGElement;
    const swing = svg('g', {}, g) as SVGGElement;
    svg('path', { d: legPath(-hip[1], b.thick, b.paw, hind), fill }, swing);
    legs.push(swing);
  };
  // Far legs sit behind the body in the darkest tone
  addLeg([hipF[0] + 6, hipF[1]], 'var(--jr-wolf-1)', false);
  addLeg([hipB[0] + 6, hipB[1]], 'var(--jr-wolf-1)', true);

  // Tail, sweeping back and down from the rump
  const t = b.tail, rx = -L / 2;
  svg('path', { d: d([[rx + 2, top + H * 0.12], [rx - 26 * t, top + H * 0.2], [rx - 50 * t, top + H * 0.55], [rx - 38 * t, top + H * 0.62], [rx - 22 * t, top + H * 0.48], [rx - 2, top + H * 0.5]]), fill: 'var(--jr-wolf-2)' }, parent);
  svg('path', { d: d([[rx + 2, top + H * 0.12], [rx - 26 * t, top + H * 0.2], [rx - 50 * t, top + H * 0.55], [rx - 24 * t, top + H * 0.34]]), fill: 'var(--jr-wolf-3)' }, parent);

  // Torso: base, then facets
  const rump: Pt = [rx - 4, top + H * 0.45], rumpTop: Pt = [rx + 4, top + 3], back: Pt = [0, top + 2], wither: Pt = [L / 2 - 8, top - 2];
  const chest: Pt = [L / 2 + 10, top + H * 0.5], chestLow: Pt = [L / 2 - 2, belly + 2], tuck: Pt = [-L * 0.1, belly - H * 0.12], haunch: Pt = [rx + 8, belly];
  svg('path', { d: d([rumpTop, back, wither, chest, chestLow, tuck, haunch, rump]), fill: 'var(--jr-wolf-2)' }, parent);
  const mid: Pt = [L * 0.05, top + H * 0.5];
  svg('path', { d: d([rumpTop, back, wither, [L / 2 - 4, top + H * 0.35], mid, [rx + 4, top + H * 0.4]]), fill: 'var(--jr-wolf-3)' }, parent);
  svg('path', { d: d([back, wither, [L * 0.25, top + H * 0.3]]), fill: 'var(--jr-wolf-4)' }, parent);
  svg('path', { d: d([wither, chest, chestLow, [L * 0.28, top + H * 0.55]]), fill: 'var(--jr-wolf-3)' }, parent);
  svg('path', { d: d([[rx + 4, top + H * 0.4], mid, tuck, haunch, rump]), fill: 'var(--jr-wolf-1)', opacity: 0.55 }, parent);

  // Mane: a jagged collar behind the head, bigger with age
  const hx = L / 2 + 2, hy = top + 2, s = b.head;
  if (b.ruff > 0) {
    const r = b.ruff;
    svg('path', { d: d([[hx - 4, hy - 14 * s], [hx - 14 - 8 * r, hy - 6], [hx - 8 - 4 * r, hy - 2], [hx - 16 - 8 * r, hy + 8], [hx - 6 - 3 * r, hy + 8], [hx - 12 - 6 * r, hy + 20 * r], [hx + 4, hy + 18]]), fill: 'var(--jr-wolf-3)' }, parent);
  }

  // Head, in its own frame at the top of the chest
  const m = b.muzzle, e = b.ear;
  const H_: Pt[] = [[-8, 6], [-2, -16], [10, -20], [18, -19], [18 + 16 * m, -12], [18 + 22 * m, -8], [18 + 19 * m, -2], [16 + 8 * m, 2], [14, 12], [6, 22]];
  const at = (p: Pt): Pt => [hx + p[0] * s, hy + p[1] * s];
  svg('path', { d: d(H_.map(at)), fill: 'var(--jr-wolf-2)' }, parent);
  svg('path', { d: d(([[-2, -16], [10, -20], [18, -19], [18 + 16 * m, -12], [14, -7], [2, -6]] as Pt[]).map(at)), fill: 'var(--jr-wolf-4)' }, parent);
  svg('path', { d: d(([[18 + 16 * m, -12], [18 + 22 * m, -8], [18 + 19 * m, -2], [16 + 8 * m, 2], [14, -7]] as Pt[]).map(at)), fill: b.grey ? 'var(--jr-muzzle)' : 'var(--jr-wolf-3)' }, parent);
  if (b.grey) svg('path', { d: d(([[6, 22], [14, 12], [16, 4], [8, 8]] as Pt[]).map(at)), fill: 'var(--jr-muzzle)', opacity: 0.7 }, parent);
  // Ears: outer and lit inner
  svg('path', { d: d(([[0, -16], [3 * e, -34 * e], [12, -19]] as Pt[]).map(at)), fill: 'var(--jr-wolf-3)' }, parent);
  svg('path', { d: d(([[3, -18], [4 * e, -29 * e], [9, -19]] as Pt[]).map(at)), fill: 'var(--jr-wolf-4)' }, parent);
  // Eye
  const [ex, ey] = at([17, -12]);
  svg('circle', { cx: ex, cy: ey, r: 1.6 * s, fill: 'var(--jr-rim)', opacity: 0.85 }, parent);

  // Rim light along the back, neck and head
  svg('path', { d: open([rumpTop, back, wither, at([-2, -16]), at([3 * e, -34 * e]), at([12, -19]), at([18, -19]), at([18 + 16 * m, -12]), at([18 + 22 * m, -8])]), fill: 'none', stroke: 'var(--jr-rim)', 'stroke-width': 1.8, 'stroke-linejoin': 'round', opacity: 0.75 }, parent);

  // Near legs in front of the body
  addLeg(hipF, 'var(--jr-wolf-2)', false);
  addLeg(hipB, 'var(--jr-wolf-2)', true);
  // Order: far front, far back, near front, near back
  return legs;
}

export function drawWolf(parent: SVGGElement): Wolf {
  const body = svg('g', {}, parent) as SVGGElement;
  const ages: SVGGElement[] = [], legs: SVGGElement[] = [];
  BUILDS.forEach((b, i) => {
    const g = svg('g', { opacity: i === 0 ? 1 : 0 }, body) as SVGGElement;
    ages.push(g);
    legs.push(...drawAge(b, g));
  });
  return { ages, legs, body };
}

/** Pose for one frame. `age` is fractional while cross-fading between two drawings. */
export function poseWolf(w: Wolf, phase: number, moving: boolean, age: number): void {
  const lo = Math.floor(age), hi = Math.min(3, lo + 1), f = age - lo;
  w.ages.forEach((g, i) => g.setAttribute('opacity', String(i === lo ? 1 - f : i === hi ? f : 0)));
  const a = moving ? Math.sin(phase) * 26 : 0;
  // Per age: far front, far back, near front, near back. Front and back pairs swing against each other
  const swing = [-a * 0.8, a * 0.8, a, -a];
  w.legs.forEach((l, i) => l.setAttribute('transform', `rotate(${swing[i % 4].toFixed(1)})`));
  w.body.setAttribute('transform', `translate(0,${moving ? (-6 * Math.abs(Math.sin(phase))).toFixed(1) : 0})`);
}
