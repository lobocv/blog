// Illustrative radar pulses for the log moisture meter page: one through air (the calibration
// reference) and one through wood that gets weaker and wider as moisture goes up. Like the real
// calibration, the wood pulse is lined up so its envelope first reaches 7 mV (the first break) at
// the same moment as the air pulse's. The shapes are made up; only the 7 mV and 50 mV levels are real.

export const BOX = { w: 600, h: 220, l: 44, r: 16, t: 16, b: 28 };
export const MV = { max: 55, min: -45 };
export const FULL_SCALE_MV = 50;
export const FIRST_BREAK_MV = 7;

/** A few crests of a sine wave under a bell-shaped envelope. Times are fractions of the time axis. */
export interface Pulse { amp: number; centre: number; width: number; period: number }

/** Where the time axis ends, just after the wettest pulse has died out */
export const TMAX = 0.4;

export const AIR: Pulse = { amp: FULL_SCALE_MV, centre: 0.15, width: 0.045, period: 0.03 };

/** The pulse through wood for a moisture level from 0 (driest) to 1 (wettest). */
export function woodPulse(moisture: number): Pulse {
  const m = Math.min(1, Math.max(0, moisture));
  const shape = { amp: 40 * Math.exp(-1.4 * m), centre: 0, width: 0.075 * (1 + 0.4 * m), period: 0.045 * (1 + 0.25 * m) };
  return { ...shape, centre: AIR.centre - rise(AIR) + rise(shape) };
}

/** How long before its peak a pulse's envelope (the outline of its crests) reaches 7 mV. */
function rise(p: Pulse): number {
  return p.width * Math.sqrt(Math.log(p.amp / FIRST_BREAK_MV));
}

export function value(p: Pulse, t: number): number {
  const u = (t - p.centre) / p.width;
  return p.amp * Math.exp(-u * u) * Math.cos((2 * Math.PI * (t - p.centre)) / p.period);
}

/** The pulse sampled across the time axis (0 to TMAX), as [time, mV] pairs. */
export function samples(p: Pulse, n = 400): [number, number][] {
  return Array.from({ length: n + 1 }, (_, i) => [(i / n) * TMAX, value(p, (i / n) * TMAX)]);
}

export const x = (t: number) => BOX.l + (t / TMAX) * (BOX.w - BOX.l - BOX.r);
export const y = (mv: number) => BOX.t + ((MV.max - mv) / (MV.max - MV.min)) * (BOX.h - BOX.t - BOX.b);

export function toPath(points: [number, number][], fx = x, fy = y): string {
  return points.map(([t, v], i) => `${i ? 'L' : 'M'}${fx(t).toFixed(1)} ${fy(v).toFixed(1)}`).join('');
}
