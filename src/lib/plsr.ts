// A real (if tiny) PLS regression trained on the made-up waveforms from waveform.ts, so the PLSR
// figure on the log moisture meter page shows weights and readings that come from an actual fit.

import { samples, woodPulse } from './waveform';

export const POINTS = 320;
const COMPONENTS = 4;
const TRAINING = 41;

/** The wood waveform as the model sees it: POINTS evenly spaced voltage samples. */
export function wave(moisture: number): number[] {
  return samples(woodPulse(moisture), POINTS - 1).map(([, v]) => v);
}

/** Small seeded RNG so the training noise (and so the weights) are the same on every build. */
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);

/** Solve A x = b by Gaussian elimination with partial pivoting (A is tiny). */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const out = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) out[r] = (M[r][n] - dot(M[r].slice(r + 1, n), out.slice(r + 1))) / M[r][r];
  return out;
}

export interface Model { weights: number[]; intercept: number; training: { moisture: number; wave: number[] }[] }

/** PLS1 by NIPALS, folded into one weight per point plus an intercept. */
export function train(): Model {
  const rand = rng(7);
  const training = Array.from({ length: TRAINING }, (_, i) => {
    const moisture = i / (TRAINING - 1);
    return { moisture, wave: wave(moisture).map(v => v + (rand() - 0.5) * 1.5) };
  });
  const xMean = Array.from({ length: POINTS }, (_, j) => training.reduce((s, r) => s + r.wave[j], 0) / TRAINING);
  const yMean = training.reduce((s, r) => s + r.moisture, 0) / TRAINING;
  let X = training.map(r => r.wave.map((v, j) => v - xMean[j]));
  let Y = training.map(r => r.moisture - yMean);

  const W: number[][] = [], P: number[][] = [], q: number[] = [];
  for (let k = 0; k < COMPONENTS; k++) {
    let w = Array.from({ length: POINTS }, (_, j) => X.reduce((s, row, i) => s + row[j] * Y[i], 0));
    const norm = Math.hypot(...w);
    w = w.map(v => v / norm);
    const t = X.map(row => dot(row, w));
    const tt = dot(t, t);
    const p = Array.from({ length: POINTS }, (_, j) => X.reduce((s, row, i) => s + row[j] * t[i], 0) / tt);
    const qk = dot(Y, t) / tt;
    X = X.map((row, i) => row.map((v, j) => v - t[i] * p[j]));
    Y = Y.map((v, i) => v - t[i] * qk);
    W.push(w); P.push(p); q.push(qk);
  }

  // weights = W (PᵀW)⁻¹ q
  const PtW = P.map(p => W.map(w => dot(p, w)));
  const c = solve(PtW, q);
  const weights = Array.from({ length: POINTS }, (_, j) => W.reduce((s, w, k) => s + w[j] * c[k], 0));
  return { weights, intercept: yMean - dot(weights, xMean), training };
}

export function predict(model: Model, w: number[]): number {
  return model.intercept + dot(model.weights, w);
}

let cached: Model | undefined;
export const model = () => (cached ??= train());
