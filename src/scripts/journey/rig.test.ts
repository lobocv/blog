import { describe, expect, it } from 'vitest';
import { buildAt, DUTY, LEGS, skeleton, strideLength, type Pose, type Pt } from './rig';

const AGES = [0, 0.5, 1, 2, 3];
const STEPS = 400;
const phases = Array.from({ length: STEPS }, (_, i) => i / STEPS);
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const frac = (x: number) => x - Math.floor(x);
/** Every point of a pose, in a stable order */
const points = (p: Pose): Pt[] => [...Object.values(p.pts), ...p.tail, ...p.legs.flatMap(l => l.joints)];

describe('skeleton', () => {
  it('keeps a planted paw fixed on the ground while the ground moves under it', () => {
    for (const age of AGES) {
      const b = buildAt(age), stride = strideLength(age);
      LEGS.forEach((leg, k) => {
        // World x of the paw is its x on screen plus the distance the wolf has run
        const stance = phases.filter(c => { const ph = frac(c - leg.t0); return ph > 0.001 && ph < DUTY - 0.001; })
          .map(c => { const toe = skeleton(b, leg.t0 + frac(c - leg.t0), 1).legs[k].joints[3]; return [toe[0] + stride * frac(c - leg.t0), toe[1]]; });
        expect(stance.length).toBeGreaterThan(50);
        for (const [x, y] of stance) {
          expect(x).toBeCloseTo(stance[0][0], 4);
          expect(y).toBeCloseTo(stance[0][1], 4);
        }
      });
    }
  });

  it('never stretches or shrinks a leg bone', () => {
    for (const age of AGES) {
      const b = buildAt(age);
      const ref = skeleton(b, 0, 1).legs.map(l => [0, 1, 2].map(i => dist(l.joints[i], l.joints[i + 1])));
      for (const c of phases) skeleton(b, c, 1).legs.forEach((l, k) => {
        for (let i = 0; i < 3; i++) expect(dist(l.joints[i], l.joints[i + 1])).toBeCloseTo(ref[k][i], 6);
      });
    }
  });

  it('keeps every leg joint above the ground', () => {
    for (const age of AGES) for (const c of phases)
      for (const l of skeleton(buildAt(age), c, 1).legs) for (const j of l.joints) expect(j[1]).toBeGreaterThan(0);
  });

  it('lands hind, hind, front, front', () => {
    const order = [...LEGS].sort((a, b) => a.t0 - b.t0).map(l => l.hind);
    expect(order).toEqual([true, true, false, false]);
  });

  it('has all four paws off the ground after the hind push and again after the front push', () => {
    const planted = (c: number) => skeleton(buildAt(2), c, 1).legs.filter(l => l.planted).length;
    const air = phases.filter(c => planted(c) === 0);
    const lastHindOff = Math.max(...LEGS.filter(l => l.hind).map(l => l.t0 + DUTY));
    const firstFrontOn = Math.min(...LEGS.filter(l => !l.hind).map(l => l.t0));
    expect(air.some(c => c > lastHindOff && c < firstFrontOn)).toBe(true);
    expect(air.some(c => c > 0.9)).toBe(true);
  });

  it('repeats every stride, so a rewind plays the same poses backwards', () => {
    const b = buildAt(2), a = points(skeleton(b, 0.3, 1));
    for (const other of [1.3, -0.7]) points(skeleton(b, other, 1)).forEach((p, i) => {
      expect(p[0]).toBeCloseTo(a[i][0], 6);
      expect(p[1]).toBeCloseTo(a[i][1], 6);
    });
  });

  it('moves without jumps anywhere in the stride', () => {
    for (const age of AGES) {
      const b = buildAt(age);
      let prev = points(skeleton(b, 0, 1));
      for (let i = 1; i <= STEPS; i++) {
        const cur = points(skeleton(b, i / STEPS, 1));
        cur.forEach((p, k) => expect(dist(p, prev[k])).toBeLessThan(3));
        prev = cur;
      }
    }
  });

  it('flexes the spine: hips and shoulders are closest when gathered, furthest when stretched', () => {
    const b = buildAt(2);
    const span = (c: number) => { const p = skeleton(b, c, 1).pts; return dist(p.hip, p.shoulder); };
    const spans = phases.map(span);
    const gathered = phases[spans.indexOf(Math.min(...spans))], stretched = phases[spans.indexOf(Math.max(...spans))];
    expect(Math.max(...spans) - Math.min(...spans)).toBeGreaterThan(6);
    // Gathered in the flight after the front legs push off; stretched around the hind push-off
    expect(gathered).toBeGreaterThan(0.8);
    expect(stretched).toBeGreaterThan(0.25);
    expect(stretched).toBeLessThan(0.55);
  });

  it('holds the head steadier than the shoulders', () => {
    const b = buildAt(2);
    const range = (name: string) => { const ys = phases.map(c => skeleton(b, c, 1).pts[name][1]); return Math.max(...ys) - Math.min(...ys); };
    expect(range('skull')).toBeLessThan(range('withers') * 0.75);
  });

  it('stands still with all four paws down when there is no gait', () => {
    const b = buildAt(2), a = skeleton(b, 0.1, 0), c = skeleton(b, 0.6, 0);
    expect(a.legs.every(l => l.planted)).toBe(true);
    points(a).forEach((p, i) => expect(dist(p, points(c)[i])).toBeCloseTo(0, 6));
  });
});

describe('strideLength', () => {
  it('is shorter for the pup than the adult', () => {
    expect(strideLength(0)).toBeLessThan(strideLength(2));
  });
  it('blends between ages', () => {
    expect(strideLength(0.5)).toBeCloseTo((strideLength(0) + strideLength(1)) / 2);
  });
});

describe('buildAt', () => {
  it('only greys the muzzle after the adult years', () => {
    expect(buildAt(2).grey).toBe(0);
    expect(buildAt(2.5).grey).toBeCloseTo(0.5);
    expect(buildAt(3).grey).toBe(1);
  });
});
