// Hootsuite, Architecture: standards and tooling for the whole organization. The summit, above the
// cloud, where the wolf passes a line of cairns that mark the trail for everyone who follows.
import { el, GROUND_Y, layerX, type DrawScene, type Prop } from '../kit';
import { cloud, groundBand, seeded, shape, line } from './util';

export const drawSummit: DrawScene = ({ mid, ground }, { x0, x1 }) => {
  const rnd = seeded(2024), props: Prop[] = [], gy = GROUND_Y;
  groundBand(ground, x0, x1, gy, 'var(--stone-d)', 'var(--jr-snow)');
  // A sea of cloud below, with other peaks coming up through it
  for (const dx of [80, 330, 560]) {
    const x = layerX(x0 + dx, 0.6), h = 50 + rnd() * 40;
    shape(mid, [[x - 70, 250], [x, 250 - h], [x + 80, 250]], 'var(--stone-d)');
    shape(mid, [[x, 250 - h], [x - 20, 250 - h * 0.6], [x + 4, 250 - h * 0.7], [x + 24, 250 - h * 0.6]], 'var(--jr-snow)');
  }
  for (let x = x0 - 80; x < x1 + 40; x += 90 + rnd() * 50) cloud(mid, layerX(x, 0.6), 254, 100 + rnd() * 50, 22 + rnd() * 10, 0.9);

  // Cairns along the trail, each with a marker flag
  for (let x = x0 + 90; x < x1 - 40; x += 150) {
    const c = el('g', {}, ground);
    let y = gy;
    for (const [w, h] of [[30, 12], [24, 11], [17, 10], [10, 8]]) {
      shape(c, [[x - w / 2, y], [x - w / 2 + 3, y - h], [x + w / 2 - 2, y - h], [x + w / 2, y]], 'var(--stone)');
      shape(c, [[x + 1, y], [x + 2, y - h], [x + w / 2 - 2, y - h], [x + w / 2, y]], 'var(--stone-l)');
      y -= h;
    }
    line(c, [[x, y], [x, y - 26]], 'var(--jr-frame)', 1.6);
    shape(c, [[x, y - 26], [x + 16, y - 21], [x, y - 16]], 'var(--jr-gpr)');
    props.push({ el: c, x, layer: 1 });
  }

  // The summit marker: a survey post with signs pointing the way down every side
  const post = el('g', {}, ground), sx = x0 + 390;
  shape(post, [[sx - 40, gy], [sx - 18, gy - 22], [sx + 22, gy - 24], [sx + 44, gy]], 'var(--stone)');
  shape(post, [[sx + 2, gy - 23], [sx + 22, gy - 24], [sx + 44, gy], [sx + 6, gy]], 'var(--stone-l)');
  line(post, [[sx, gy - 22], [sx, gy - 104]], 'var(--jr-wood)', 4);
  for (const [dy, dir, w] of [[98, 1, 44], [84, -1, 38], [70, 1, 34]]) {
    shape(post, [[sx, gy - dy], [sx + dir * w, gy - dy], [sx + dir * (w + 8), gy - dy + 5], [sx + dir * w, gy - dy + 10], [sx, gy - dy + 10]], 'var(--jr-wood)');
    line(post, [[sx + dir * 6, gy - dy + 5], [sx + dir * (w - 4), gy - dy + 5]], 'var(--jr-target)', 1.2, { opacity: 0.7 });
  }
  props.push({ el: post, x: sx, layer: 1 });
  return { props };
};
