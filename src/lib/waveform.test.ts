import { describe, expect, it } from 'vitest';
import { AIR, FIRST_BREAK_MV, samples, toPath, woodPulse, type Pulse } from './waveform';

/** Time the pulse's envelope first reaches 7 mV */
const envelopeStart = (p: Pulse) => p.centre - p.width * Math.sqrt(Math.log(p.amp / FIRST_BREAK_MV));

describe('woodPulse', () => {
  it('gets weaker and wider as moisture rises', () => {
    const dry = woodPulse(0);
    const wet = woodPulse(1);
    expect(wet.amp).toBeLessThan(dry.amp);
    expect(wet.width).toBeGreaterThan(dry.width);
  });

  it('is always weaker than the air pulse, but still reaches 7 mV', () => {
    expect(woodPulse(0).amp).toBeLessThan(AIR.amp);
    expect(woodPulse(1).amp).toBeGreaterThan(FIRST_BREAK_MV);
  });

  it('is lined up with the air pulse where both envelopes reach 7 mV', () => {
    for (const m of [0, 0.3, 0.7, 1]) expect(envelopeStart(woodPulse(m))).toBeCloseTo(envelopeStart(AIR), 10);
  });

  it('clamps moisture to 0..1', () => {
    expect(woodPulse(-1)).toEqual(woodPulse(0));
    expect(woodPulse(2)).toEqual(woodPulse(1));
  });
});

describe('toPath', () => {
  it('starts with a move and draws a line to every other sample', () => {
    const d = toPath(samples(AIR, 4));
    expect(d.startsWith('M')).toBe(true);
    expect(d.match(/L/g)).toHaveLength(4);
  });
});
