// The journey wolf's skeleton: where every joint is at a point in the stride. No drawing here.
// Coordinates: x forward (the wolf faces right), y up, ground at y = 0, the middle of the back at x = 0.
//
// The run is a gallop, built from the ground up:
//  - Each paw has a stance (planted, moving back at exactly ground speed) and a swing (lifted, reaching forward).
//    Legs are solved backwards from the paw to the hip, so a planted paw never slides or sinks.
//  - The spine bends between two rigid halves, the ribcage and the pelvis. It arches while the legs gather
//    under the body and flattens as they stretch out, which carries the hips and shoulders with it.
//  - The body pitches and rises with the push of each pair of legs; the head stays nearly level.
export type Pt = [number, number];

const TAU = Math.PI * 2, RAD = Math.PI / 180;
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
const frac = (x: number) => x - Math.floor(x);
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rot = ([x, y]: Pt, a: number): Pt => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };

/** Proportions, as multiples of the adult's */
export interface Build {
  /** body length, chest depth, leg length, leg thickness */ len: number; depth: number; leg: number; thick: number;
  /** head size; muzzle, ears and paws relative to their adult share */ head: number; muzzle: number; ear: number; paw: number;
  tail: number; /** neck fur */ ruff: number; /** grey muzzle, 0 to 1 */ grey: number;
}
const BUILDS: Build[] = [
  { len: 0.62, depth: 0.72, leg: 0.56, thick: 0.86, head: 0.8, muzzle: 0.62, ear: 1.1, paw: 1.4, tail: 0.5, ruff: 0, grey: 0 },    // pup
  { len: 0.9, depth: 0.8, leg: 0.96, thick: 0.8, head: 0.9, muzzle: 0.92, ear: 1.1, paw: 1.1, tail: 0.85, ruff: 0.3, grey: 0 },   // yearling
  { len: 1, depth: 1, leg: 1, thick: 1, head: 1, muzzle: 1, ear: 1, paw: 1, tail: 1, ruff: 1, grey: 0 },                          // adult
  { len: 1, depth: 1, leg: 1, thick: 1, head: 1, muzzle: 1, ear: 1, paw: 1, tail: 1, ruff: 1, grey: 1 },                          // grey muzzle
];

/** The build at a fractional age (0 pup, 1 yearling, 2 adult, 3 grey muzzle), so the wolf grows smoothly */
export function buildAt(age: number): Build {
  const a = Math.max(0, Math.min(3, age)), lo = Math.floor(a), hi = Math.min(3, lo + 1), f = a - lo;
  const out = {} as Build;
  for (const k of Object.keys(BUILDS[0]) as (keyof Build)[]) out[k] = lerp(BUILDS[lo][k], BUILDS[hi][k], f);
  return out;
}

/** Share of the stride each paw spends on the ground */
export const DUTY = 0.26;
/** Ground an adult's planted paw passes over during its stance */
const SWEEP = 52;
/** Paws in drawing order (far side first). `t0` is when each lands: hind, hind, a moment of flight, front, front, flight. */
export const LEGS = [
  { id: 'hindFar', hind: true, far: true, t0: 0 },
  { id: 'frontFar', hind: false, far: true, t0: 0.46 },
  { id: 'hindNear', hind: true, far: false, t0: 0.09 },
  { id: 'frontNear', hind: false, far: false, t0: 0.55 },
] as const;

/** Ground covered by one stride at an age, before display scale. Follows from the stance, so paws keep pace with the ground. */
export function strideLength(age: number): number {
  return SWEEP * buildAt(age).leg / DUTY;
}

// Adult measurements
const HIP_H = 64;                                   // standing hip height
const HIP: Pt = [-42, -18], SHOULDER: Pt = [40, -26]; // joints, relative to the middle of the back
const HIND_BONES = [24, 30, 22], FRONT_BONES = [22, 27, 14];  // thigh, shank, foot; upper arm, forearm, foot
const PAD = 2.5;                                    // height of the paw's joint above the ground when planted
const RUN_NECK = 30 * RAD;                           // how far above level the neck reaches at a run
const FAR_DX = 5;                                   // the far legs sit a little forward, so both of a pair show

export interface LegPose {
  id: string; hind: boolean; far: boolean; planted: boolean;
  /** hip or shoulder, knee or elbow, hock or wrist, paw */ joints: [Pt, Pt, Pt, Pt];
  /** direction the paw points, radians (0 is flat on the ground) */ paw: number;
}
export interface Pose {
  build: Build;
  /** Named points on the trunk and head */ pts: Record<string, Pt>;
  /** Place a point given in ribcage, pelvis, waist or head coordinates */
  T: (x: number, y: number) => Pt; P: (x: number, y: number) => Pt; W: (x: number, y: number) => Pt; H: (x: number, y: number) => Pt;
  legs: LegPose[];
  /** tail, base to tip */ tail: Pt[];
  /** 0 with a paw on the ground, towards 1 in mid-flight */ air: number;
}

/**
 * A three-bone leg that folds like a real one: every joint bends in proportion (`k` gives each bone's
 * share and direction), by just enough to span from hip to paw.
 */
function solveLeg(hip: Pt, paw: Pt, bones: number[], k: number[]): [Pt, Pt, Pt, Pt] {
  const total = bones[0] + bones[1] + bones[2];
  const dx = paw[0] - hip[0], dy = paw[1] - hip[1];
  const want = Math.min(total * 0.995, Math.max(total * 0.3, Math.hypot(dx, dy)));
  const end = (a: number): Pt => [0, 1, 2].reduce<Pt>((p, i) => [p[0] + bones[i] * Math.cos(k[i] * a), p[1] + bones[i] * Math.sin(k[i] * a)], [0, 0]);
  let lo = 0, hi = 1.5;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2, e = end(mid); if (Math.hypot(e[0], e[1]) > want) lo = mid; else hi = mid; }
  const a = (lo + hi) / 2, e = end(a), turn = Math.atan2(dy, dx) - Math.atan2(e[1], e[0]);
  const out: Pt[] = [hip];
  for (let i = 0; i < 3; i++) { const p = out[i], ang = k[i] * a + turn; out.push([p[0] + bones[i] * Math.cos(ang), p[1] + bones[i] * Math.sin(ang)]); }
  return out as [Pt, Pt, Pt, Pt];
}

/**
 * The whole skeleton at a point in the stride. `cycle` counts strides (it runs backwards on a rewind);
 * `gait` is 1 for the gallop and 0 for standing still.
 */
export function skeleton(b: Build, cycle: number, gait: number): Pose {
  const c = frac(cycle);

  // --- Trunk. Arch is +1 fully gathered, about -0.5 fully stretched.
  const wave = Math.cos(TAU * (c - 0.93));
  const arch = (0.75 * wave + 0.25 * wave * wave) * gait;
  // Nose up while the hind legs drive, nose down as the front legs take the landing
  const pitch = 4.5 * RAD * Math.sin(TAU * (c + 0.05)) * gait;
  const ribs = pitch - arch * 8 * RAD, pelvis = pitch + arch * 20 * RAD;
  // Highest in the gathered flight, lowest stretched out, with a small lift off each push
  const rise = (3 * Math.cos(TAU * (c - 0.92)) + 1.2 * Math.cos(2 * TAU * (c - 0.4))) * b.leg * gait;
  const mid: Pt = [0, HIP_H * b.leg - HIP[1] * b.depth + rise];
  const frame = (a: number) => (x: number, y: number): Pt => { const p = rot([x * b.len, y * b.depth], a); return [mid[0] + p[0], mid[1] + p[1]]; };
  const T = frame(ribs), P = frame(pelvis), W = frame((ribs + pelvis) / 2);

  // --- Neck and head. The head is carried low and forward at a run, and holds its height while the body moves under it.
  const neckBase = T(44, -6), neckLen = 25 * lerp(b.len, b.head, 0.5);
  const neckAngle = lerp(40 * RAD, RUN_NECK + 5 * RAD * arch + 0.4 * ribs, gait);
  const reach: Pt = [neckBase[0] + neckLen * Math.cos(neckAngle), neckBase[1] + neckLen * Math.sin(neckAngle)];
  const still = rot([44 * b.len, -6 * b.depth], 0);
  const steady: Pt = [still[0] + neckLen * Math.cos(RUN_NECK), HIP_H * b.leg - HIP[1] * b.depth + still[1] + neckLen * Math.sin(RUN_NECK)];
  const skull: Pt = [lerp(reach[0], steady[0], 0.5 * gait), lerp(reach[1], steady[1], 0.8 * gait)];
  const headAngle = lerp(-4 * RAD, -7 * RAD + 0.3 * ribs + 2 * RAD * Math.sin(TAU * (c - 0.7)), gait);
  const hs = 1.12 * b.head;
  const H = (x: number, y: number): Pt => { const p = rot([x * hs, y * hs], headAngle); return [skull[0] + p[0], skull[1] + p[1]]; };

  const pts: Record<string, Pt> = {
    mid, skull,
    hip: P(HIP[0], HIP[1]), shoulder: T(SHOULDER[0], SHOULDER[1]),
    tailBase: P(-50, -3), croup: P(-32, 3), backRear: P(-12, 4), backFront: T(12, 4), withers: T(28, 6), neckTop: T(40, 4),
    chestFront: T(52, -20), brisket: T(46, -42), chestBottom: T(22, -49), tuck: W(-4, -39), flank: P(-20, -36), seat: P(-46, -30), buttock: P(-55, -14),
  };

  // --- Legs
  const pad = PAD * b.leg * b.paw, sweep = SWEEP * b.leg;
  let air = 1;
  const legs: LegPose[] = LEGS.map(L => {
    const side = L.far ? FAR_DX * b.len : 0;
    const home = (L.hind ? HIP[0] : SHOULDER[0]) * b.len + side;
    const ph = frac(c - L.t0), planted = gait === 0 || ph < DUTY;
    // Touchdown is ahead of the joint, lift-off behind it
    const down = home + (L.hind ? 32 : 22) * b.leg, up = down - sweep;
    let x: number, y = 0, swing = 0;
    if (ph < DUTY) x = down - sweep * ph / DUTY;
    else {
      const u = (ph - DUTY) / (1 - DUTY), u2 = u * u, u3 = u2 * u;
      // Leaves and meets the ground at ground speed, so the paw is already moving back when it lands
      const v = -sweep / DUTY * (1 - DUTY);
      x = up * (2 * u3 - 3 * u2 + 1) + v * (u3 - 2 * u2 + u) + down * (3 * u2 - 2 * u3) + v * (u3 - u2);
      y = (L.hind ? 19 : 19) * b.leg * Math.sin(Math.PI * Math.pow(u, 0.85)) ** 2;
      swing = smooth(0, 0.18, u) * (1 - smooth(0.8, 1, u));
    }
    const standX = home + (L.hind ? -10 : -3) * b.leg;
    const paw: Pt = [lerp(standX, x, gait), pad + y * gait];
    swing *= gait;
    air = Math.min(air, (paw[1] - pad) / (10 * b.leg));

    const joint = L.hind ? pts.hip : pts.shoulder;
    // The shoulder blade slides over the ribs, following the paw a little
    const glide = L.hind ? 0 : 0.1 * (paw[0] - home);
    const top: Pt = [joint[0] + side + glide, joint[1] + (L.far ? 1.5 * b.depth : 0)];
    const bones = (L.hind ? HIND_BONES : FRONT_BONES).map(n => n * b.leg);
    // Hind: knee forward, hock back. Front: elbow back, and the wrist folds the paw up under the chest in the swing.
    const k = L.hind ? [0.85, -1, 0.8 + 0.5 * swing] : [-1, 0.7, 0.15 - 1.5 * swing];
    const joints = solveLeg(top, paw, bones, k);
    const [mx, my] = [joints[3][0] - joints[2][0], joints[3][1] - joints[2][1]];
    return { id: L.id, hind: L.hind, far: L.far, planted, joints, paw: swing * (Math.atan2(mx, -my) - 40 * RAD) };
  });

  // --- Tail: hangs when standing; streams out behind at a run, each part following the one before
  const tail: Pt[] = [pts.tailBase];
  [16, 16, 15].forEach((n, i) => {
    const hang = (58 + 7 * i) * RAD;
    const stream = (14 + 7 * i) * RAD + 9 * RAD * Math.sin(TAU * (c - 0.3 - 0.13 * i)) + pelvis * 0.5;
    const a = Math.PI + lerp(hang, stream, gait), p = tail[i], len = n * b.tail;
    tail.push([p[0] + len * Math.cos(a), p[1] + len * Math.sin(a)]);
  });

  return { build: b, pts, T, P, W, H, legs, tail, air: Math.max(0, Math.min(1, air)) };
}
