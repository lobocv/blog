import { describe, expect, it } from 'vitest';
import { gaitAngles, strideLength } from './wolf';

const keys: [number, number, number][] = [[0, -30, 0], [0.5, 30, 80], [1, -30, 0]];

describe('gaitAngles', () => {
  it('hits keyframes exactly', () => {
    expect(gaitAngles(keys, 0)).toEqual([-30, 0]);
    expect(gaitAngles(keys, 0.5)).toEqual([30, 80]);
  });
  it('eases halfway between keyframes', () => {
    const [u, l] = gaitAngles(keys, 0.25);
    expect(u).toBeCloseTo(0);
    expect(l).toBeCloseTo(40);
  });
  it('wraps past one cycle and below zero, so rewinding plays the stride backwards', () => {
    expect(gaitAngles(keys, 1.25)).toEqual(gaitAngles(keys, 0.25));
    expect(gaitAngles(keys, -0.75)).toEqual(gaitAngles(keys, 0.25));
  });
});

describe('strideLength', () => {
  it('matches the ground a planted front paw sweeps over in its stance', () => {
    // adult hip is 41 units up; stance swings the leg from -38deg to +32deg over 0.38 of a stride
    const sweep = 41 * (Math.sin(38 * Math.PI / 180) + Math.sin(32 * Math.PI / 180));
    expect(strideLength(2)).toBeCloseTo(sweep / 0.38, 0);
  });
  it('is shorter for the pup than the adult', () => {
    expect(strideLength(0)).toBeLessThan(strideLength(2));
  });
  it('blends between ages', () => {
    expect(strideLength(0.5)).toBeCloseTo((strideLength(0) + strideLength(1)) / 2);
  });
});
