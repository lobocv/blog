// The journey wolf, side-on and running right, in the hero wolf's faceted style: a dark base,
// flat facets lit from the upper right (the way it is facing), and a rim light along the back.
// Every shape is rebuilt each frame from the skeleton in rig.ts, so the body bends and the legs
// fold as one animal rather than as rigid parts turning on pins. Ground is y = 0.
import { buildAt, skeleton, type LegPose, type Pose, type Pt } from './rig';
export { strideLength } from './rig';

const NS = 'http://www.w3.org/2000/svg';
export interface Wolf { parts: Map<string, SVGElement>; shadow: SVGElement }

type Style = { fill?: string; stroke?: string; opacity?: number; open?: boolean; width?: number };
const T1 = 'var(--jr-wolf-1)', T2 = 'var(--jr-wolf-2)', T3 = 'var(--jr-wolf-3)', T4 = 'var(--jr-wolf-4)', RIM = 'var(--jr-rim)';
const rim: Style = { stroke: RIM, open: true, width: 1.7, opacity: 0.75 };

const legParts = (id: string, far: boolean): [string, Style][] => far
  ? [[`${id}-upper`, { fill: T1 }], [`${id}-lower`, { fill: T1 }], [`${id}-foot`, { fill: T1 }], [`${id}-paw`, { fill: T1 }]]
  : [[`${id}-upper`, { fill: T2 }], [`${id}-upperLit`, { fill: T3 }], [`${id}-lower`, { fill: T2 }], [`${id}-lowerLit`, { fill: T3, opacity: 0.7 }],
    [`${id}-foot`, { fill: T2 }], [`${id}-footLit`, { fill: T3, opacity: 0.55 }], [`${id}-paw`, { fill: T2 }], [`${id}-pawLit`, { fill: T3, opacity: 0.7 }]];

/** Every shape, back to front */
const PARTS: [string, Style][] = [
  ...legParts('hindFar', true), ...legParts('frontFar', true),
  ['tail', { fill: T2 }], ['tailLit', { fill: T3 }], ['tailRim', rim],
  ['earFar', { fill: T1 }],
  ['body', { fill: T2 }], ['bodyBack', { fill: T3 }], ['bodyShoulder', { fill: T3 }], ['bodyTop', { fill: T4 }], ['bodyBelly', { fill: T1, opacity: 0.45 }], ['bodyHaunch', { fill: T3, opacity: 0.5 }],
  ['neck', { fill: T2 }], ['neckLit', { fill: T3 }], ['neckTop', { fill: T4, opacity: 0.8 }], ['neckChest', { fill: T1, opacity: 0.5 }],
  ['backRim', rim],
  ['head', { fill: T2 }], ['headCheek', { fill: T3 }], ['headTop', { fill: T4 }], ['headGrey', { fill: 'var(--jr-muzzle)' }], ['headJaw', { fill: T1, opacity: 0.55 }],
  ['ear', { fill: T3 }], ['earLit', { fill: T4 }], ['earIn', { fill: T1, opacity: 0.7 }],
  ['nose', { fill: T1 }], ['mouth', { stroke: T1, open: true, width: 1.1, opacity: 0.8 }], ['eye', { fill: RIM, opacity: 0.9 }],
  ['headRim', rim],
  ...legParts('hindNear', false), ...legParts('frontNear', false),
];

export function drawWolf(parent: SVGGElement): Wolf {
  const shadow = document.createElementNS(NS, 'ellipse');
  shadow.setAttribute('fill', '#000');
  parent.appendChild(shadow);
  const parts = new Map<string, SVGElement>();
  for (const [name, s] of PARTS) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('fill', s.fill ?? 'none');
    p.setAttribute('stroke-linejoin', 'round');
    if (s.stroke) { p.setAttribute('stroke', s.stroke); p.setAttribute('stroke-width', String(s.width)); p.setAttribute('stroke-linecap', 'round'); }
    // A hairline in the fill colour rounds the facets' corners and closes seams between moving shapes
    else if (s.opacity === undefined) { p.setAttribute('stroke', s.fill!); p.setAttribute('stroke-width', '1.2'); }
    if (s.opacity !== undefined) p.setAttribute('opacity', String(s.opacity));
    if (s.open) p.dataset.open = '1';
    parent.appendChild(p);
    parts.set(name, p);
  }
  return { parts, shadow };
}

const add = (p: Pt, a: Pt, s: number, b: Pt = [0, 0], t = 0): Pt => [p[0] + a[0] * s + b[0] * t, p[1] + a[1] * s + b[1] * t];
const mix = (a: Pt, b: Pt, f: number): Pt => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
/** Unit vector along a bone, and the one square to it (towards the wolf's front for a bone pointing down) */
function axes(a: Pt, b: Pt): [Pt, Pt] {
  const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1;
  return [[dx / n, dy / n], [-dy / n, dx / n]];
}

/** Shapes for one leg: a muscled upper part, a tapering lower part, the long foot bone and the paw */
function legShapes(l: LegPose, p: Pose, out: Record<string, Pt[]>): void {
  const [a, b, c, d] = l.joints, w = 1.32 * p.build.thick * (0.45 + 0.55 * p.build.leg), id = l.id;
  const [u1, n1] = axes(a, b), [u2, n2] = axes(b, c), [u3, n3] = axes(c, d);
  if (l.hind) {
    // Thigh: wide at the hip, with the knee as a cap at the front
    const front = add(a, n1, 11 * w, u1, 3 * w), cap = add(b, n1, 4.6 * w, u1, 3 * w);
    out[`${id}-upper`] = [add(a, u1, -10 * w), front, cap, add(b, n1, -4.6 * w, u1, 2 * w), add(a, n1, -14 * w, u1, 8 * w), add(a, n1, -12 * w, u1, -6 * w)];
    out[`${id}-upperLit`] = [front, cap, add(b, n1, -1 * w), add(a, n1, 2 * w, u1, -3 * w)];
    // Shank: the calf bulges at the top of the back edge and the hock comes to a point
    const shin = add(b, n2, 4.6 * w, u2, -3 * w), ankle = add(c, n2, 2.2 * w);
    out[`${id}-lower`] = [shin, ankle, add(c, u2, 2 * w), add(c, n2, -4.2 * w, u2, -2.5 * w), add(b, n2, -6.8 * w, u2, 7 * w), add(b, n2, -4.6 * w, u2, -2 * w)];
    out[`${id}-lowerLit`] = [shin, ankle, add(c, n2, 0.4 * w), add(b, n2, 1 * w)];
  } else {
    // Upper arm lies against the chest; the elbow juts out behind
    const front = add(a, n1, 8 * w, u1, 2 * w), fore = add(b, n1, 5 * w, u1, 2 * w);
    out[`${id}-upper`] = [add(a, u1, -8 * w), front, fore, add(b, n1, -6 * w, u1, 3 * w), add(a, n1, -9 * w)];
    out[`${id}-upperLit`] = [front, fore, add(b, n1, 0.5 * w), add(a, n1, 1 * w, u1, -2 * w)];
    const top = add(b, n2, 5 * w, u2, -2 * w), wrist = add(c, n2, 2.7 * w);
    out[`${id}-lower`] = [top, wrist, add(c, u2, 2 * w), add(c, n2, -2.7 * w), add(b, n2, -5.6 * w, u2, 6 * w), add(b, n2, -6.4 * w, u2, -3 * w)];
    out[`${id}-lowerLit`] = [top, wrist, add(c, n2, 0.6 * w), add(b, n2, 1 * w)];
  }
  const f0 = add(c, n3, 2.5 * w, u3, -2 * w), f1 = add(d, n3, 2.1 * w);
  out[`${id}-foot`] = [f0, f1, add(d, n3, -2.1 * w), add(c, n3, -2.6 * w, u3, -2 * w)];
  out[`${id}-footLit`] = [f0, f1, add(d, n3, 0.4 * w), add(c, n3, 0.4 * w, u3, -2 * w)];
  // Paw, flat on the ground when planted and trailing from the foot in the swing
  const s = p.build.leg * p.build.paw, fw: Pt = [Math.cos(l.paw), Math.sin(l.paw)], up: Pt = [-fw[1], fw[0]];
  const heel = add(d, fw, -3.2 * s, up, 2 * s), knuckle = add(d, fw, 3.5 * s, up, 3 * s), toe = add(d, fw, 8 * s, up, 0.4 * s);
  out[`${id}-paw`] = [heel, knuckle, toe, add(d, fw, 7.4 * s, up, -2.5 * s), add(d, fw, -2.6 * s, up, -2.5 * s)];
  out[`${id}-pawLit`] = [knuckle, toe, add(d, fw, 3 * s, up, 0.4 * s)];
}

/** Every shape for a pose, as points in skeleton coordinates */
function shapes(p: Pose, gait: number): Record<string, Pt[]> {
  const { pts: q, T, P, W, H, build: b } = p, out: Record<string, Pt[]> = {};
  for (const l of p.legs) legShapes(l, p, out);

  // --- Trunk: one silhouette across both halves of the spine, then planes of light and shade
  out.body = [q.tailBase, q.croup, q.backRear, q.backFront, q.withers, q.neckTop, q.chestFront, q.brisket, q.chestBottom, q.tuck, q.flank, q.seat, q.buttock];
  const blade = T(37, -9), rib = W(2, -13), loin = P(-30, -11);
  out.bodyBack = [q.tailBase, q.croup, q.backRear, q.backFront, q.withers, blade, rib, loin];
  out.bodyTop = [q.backFront, q.withers, q.neckTop, blade, T(18, -5)];
  out.bodyShoulder = [blade, q.neckTop, q.chestFront, T(46, -29), T(33, -27)];
  out.bodyBelly = [q.brisket, q.chestBottom, q.tuck, q.flank, P(-25, -29), W(-3, -31), T(22, -40), T(40, -35)];
  out.bodyHaunch = [q.croup, loin, P(-40, -20), P(-50, -10), q.tailBase];
  out.backRim = [q.croup, q.backRear, T(10, 4.5)];

  // --- Neck: spans from the ribcage to the skull, so it stretches and bends with both
  const nape = H(-7, 9), cheek = H(-10, -9), throat = H(-2, -16);
  const lift = (a: Pt, c: Pt, f: number, by: number): Pt => { const m = mix(a, c, f), [, n] = axes(a, c); return add(m, n, by); };
  // The mane: a thick ruff from behind the ears over the shoulders and down the chest, in ragged tufts
  const r = b.ruff, start = T(10, 4.5);
  const crest1 = lift(q.withers, nape, 0.15, 3 + 5 * r), crest2 = lift(q.withers, nape, 0.6, 4 + 7 * r);
  const bib1 = lift(throat, q.chestFront, 0.35, 3 + 6 * r), bib2 = lift(throat, q.chestFront, 0.8, 3 + 7 * r), mane = crest2;
  /** A point on the neck: `along` runs head to body, `across` runs top to underside */
  const on = (along: number, across: number) => mix(mix(nape, q.withers, along), mix(throat, q.chestFront, along), across);
  out.neck = [start, crest1, crest2, nape, cheek, throat, bib1, bib2, T(54, -27), q.brisket, T(38, -14)];
  out.neckLit = [start, crest1, crest2, nape, cheek, on(0.12, 0.78), on(0.28, 0.5), on(0.45, 0.85), on(0.6, 0.52), on(0.8, 0.82), on(0.95, 0.45), T(34, -6)];
  out.neckTop = [start, crest1, crest2, nape, on(0.08, 0.3), on(0.28, 0.12), on(0.42, 0.36), on(0.62, 0.12), on(0.8, 0.34), on(1, 0.1)];
  out.neckChest = [throat, bib1, bib2, T(54, -27), q.brisket, on(0.9, 0.95), on(0.7, 0.8), on(0.5, 1.02), on(0.3, 0.82)];

  // --- Head. Ears lie back at a run.
  const m = b.muzzle, e = b.ear, back = 5 * gait;
  const occ = H(-3, 11), earB = H(-2, 12), earF = H(6, 13.5), earTip = H(-1 - back, 12.5 + 10 * e - 1.5 * gait);
  const brow = H(15, 12), stop = H(22, 8), bridge = H(22 + 12 * m, 5.2), nose = H(22 + 17.5 * m, 3.4), noseU = H(22 + 18 * m, -1.6);
  const lip = H(22 + 14.5 * m, -5), chin = H(22 + 8 * m, -7.5), corner = H(17, -5.5), jaw = H(8, -13);
  out.head = [nape, occ, earB, earF, brow, stop, bridge, nose, noseU, lip, chin, jaw, throat, cheek];
  out.headTop = [occ, earF, brow, stop, bridge, nose, H(22 + 10 * m, 1.4), H(17, 4), H(3, 6)];
  out.headCheek = [H(-6, 3), H(3, 6), H(17, 4), H(22 + 10 * m, 1.4), noseU, lip, corner, H(8, -5), cheek];
  out.headGrey = [stop, bridge, nose, noseU, lip, chin, corner, H(17, 4)];
  out.headJaw = [corner, lip, chin, jaw, throat, H(6, -8)];
  out.nose = [H(22 + 15 * m, 4.2), nose, noseU, H(22 + 15.5 * m, -0.8)];
  out.mouth = [H(22 + 13.5 * m, -4.4), H(22 + 5 * m, -4), corner];
  out.eye = [H(15, 6.6), H(18, 8.2), H(20, 7), H(17.5, 5.8)];
  out.ear = [earB, earTip, earF];
  out.earLit = [mix(earB, earF, 0.45), earTip, earF];
  out.earIn = [mix(earB, earF, 0.55), mix(earTip, earF, 0.3), mix(earB, earF, 0.9)];
  out.earFar = [H(3, 13), H(4.5 - back, 13 + 9.5 * e - 1.5 * gait), H(10, 13)];
  out.headRim = [start, crest1, crest2, nape, occ, earB, earTip, earF, brow, stop, bridge, nose];

  // --- Tail: bushy in the middle, tapering to the tip
  const t = p.tail, tw = [5, 8.5, 7].map(n => n * (0.4 + 0.6 * b.tail));
  const upper: Pt[] = [], lower: Pt[] = [];
  for (let i = 0; i < 3; i++) {
    const [, n] = axes(t[i], t[Math.min(3, i + 1)]);
    // Square to a tail that points backwards, "up" is the negative side
    upper.push(add(t[i], n, -tw[i]));
    lower.push(add(t[i], n, tw[i]));
  }
  upper[0] = q.croup;
  out.tail = [...upper, t[3], ...lower.reverse(), q.buttock];
  out.tailLit = [...upper, t[3], t[2], t[1], t[0]];
  out.tailRim = [...upper, t[3]];
  return out;
}

/**
 * Pose for one frame. `cycle` is the stride position (1 = one full stride; it runs backwards on a rewind),
 * `gait` is 1 for the gallop and 0 for standing, and `age` is fractional while the wolf grows.
 */
export function poseWolf(w: Wolf, cycle: number, gait: number, age: number): void {
  const p = skeleton(buildAt(age), cycle, gait), all = shapes(p, gait);
  for (const [name, el] of w.parts) {
    const s = all[name];
    if (!s?.length) continue;
    el.setAttribute('d', 'M' + s.map(([x, y]) => `${x.toFixed(1)},${(-y).toFixed(1)}`).join('L') + (el.dataset.open ? '' : 'Z'));
  }
  w.parts.get('headGrey')!.setAttribute('opacity', (p.build.grey * 0.9).toFixed(2));
  // The shadow on the ground shrinks and fades while all four paws are in the air
  const sh = w.shadow, b = p.build;
  sh.setAttribute('cx', (2 * b.len).toFixed(1));
  sh.setAttribute('cy', '1');
  sh.setAttribute('rx', (56 * b.len * (1 - 0.18 * p.air)).toFixed(1));
  sh.setAttribute('ry', (3.2 * (1 - 0.25 * p.air)).toFixed(1));
  sh.setAttribute('opacity', (0.3 - 0.12 * p.air).toFixed(2));
}
