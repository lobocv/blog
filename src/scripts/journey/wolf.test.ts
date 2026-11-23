import { describe, expect, it } from 'vitest';
import { gaitAngles } from './wolf';

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
