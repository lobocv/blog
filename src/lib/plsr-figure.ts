// Geometry for the PLSR figure (src/components/project/PlsrFigure.astro), shared by the server
// render and the slider script.
import { model, POINTS, predict, wave } from './plsr';
import { TMAX } from './waveform';

export const W = 600;
export const H = 410;
const L = 12, R = 12;
/** The part of the time axis the figure zooms in on, where the wood pulse is */
export const T0 = 0, T1 = TMAX;
const PANEL_H = 110;

export const PANELS = [
  { title: '1. The wave, among the training waves', top: 0 },
  { title: '2. The weight PLSR learned for each point', top: PANEL_H },
  { title: '3. Wave × weight at each point', top: 2 * PANEL_H },
].map(p => ({ ...p, mid: p.top + 22 + (PANEL_H - 30) / 2 }));
const HALF = (PANEL_H - 30) / 2 - 2;

export const xAt = (t: number) => L + ((t - T0) / (T1 - T0)) * (W - L - R);
const tAt = (j: number) => (j / (POINTS - 1)) * TMAX;
const inView = (j: number) => tAt(j) >= T0 && tAt(j) <= T1;

const md = model();
const maxWave = Math.max(...md.training.flatMap(r => r.wave.map(Math.abs)));
const maxWeight = Math.max(...md.weights.map(Math.abs));
// Scaled to a mid-moisture wave so the bars are readable; taller bars are clipped to the panel
const maxProduct = Math.max(...wave(0.5).map((v, j) => Math.abs(v * md.weights[j]))) * 1.1;

function path(values: number[], mid: number, scale: number): string {
  let d = '';
  values.forEach((v, j) => {
    if (!inView(j)) return;
    d += `${d ? 'L' : 'M'}${xAt(tAt(j)).toFixed(1)} ${(mid - (v / scale) * HALF).toFixed(1)}`;
  });
  return d;
}

const weightsPath = path(md.weights, PANELS[1].mid, maxWeight);
const barW = (xAt(tAt(1)) - xAt(tAt(0))) * 0.7;

export function geometry(moisture: number) {
  const w = wave(moisture);
  const mid = PANELS[2].mid;
  const bars = w.map((v, j) => {
    const p = v * md.weights[j];
    const h = Math.min(1, Math.abs(p / maxProduct)) * HALF;
    return { x: +(xAt(tAt(j)) - barW / 2).toFixed(1), w: +barW.toFixed(1), y: +(p >= 0 ? mid - h : mid).toFixed(1), h: +h.toFixed(1), pos: p >= 0, show: inView(j) };
  }).filter(b => b.show);
  const gy = 3 * PANEL_H + 26;
  const x0 = xAt(T0), x1 = xAt(T1);
  return {
    wave: w,
    wavePath: (values: number[]) => path(values, PANELS[0].mid, maxWave),
    weightsPath,
    bars,
    reading: predict(md, w),
    gauge: { y: gy, x0, x1, at: (m: number) => +(x0 + Math.min(1, Math.max(0, m)) * (x1 - x0)).toFixed(1) },
  };
}
