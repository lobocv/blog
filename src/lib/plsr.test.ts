import { describe, expect, it } from 'vitest';
import { model, POINTS, predict, wave } from './plsr';

describe('PLSR on the illustrative waveforms', () => {
  it('has one weight per point', () => {
    expect(model().weights).toHaveLength(POINTS);
  });

  it('reads moisture back from a clean wave it was not trained on', () => {
    for (const m of [0.05, 0.33, 0.5, 0.71, 0.95]) {
      expect(Math.abs(predict(model(), wave(m)) - m)).toBeLessThan(0.06);
    }
  });

  it('is the same on every call', () => {
    expect(model()).toBe(model());
  });
});
