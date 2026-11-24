// Hootsuite, Social Analytics: the architecture was called Avalanche. A snowy pass, where a slab
// of snow lets go from the slope behind the trail as the wolf runs by.
import { el, GROUND_Y, type DrawScene, type Prop } from '../kit';
import { groundBand, pine, seeded, shape } from './util';

export const drawAvalanche: DrawScene = ({ ground }, { x0, x1 }) => {
  const rnd = seeded(2020), props: Prop[] = [], gy = GROUND_Y;
  groundBand(ground, x0, x1, gy, 'var(--jr-snow-2)', 'var(--jr-snow)');

  // The slope: a snow-covered face rising behind the trail
  const px = x0 + 250, py = 78;
  shape(ground, [[x0 - 20, gy], [px - 130, 150], [px, py], [px + 150, 140], [px + 330, gy]], 'var(--stone-d)');
  shape(ground, [[px, py], [px + 150, 140], [px + 330, gy], [px + 60, gy]], 'var(--stone)');
  shape(ground, [[px, py], [px - 70, 104], [px - 36, 96], [px - 10, 122], [px + 24, 100], [px + 58, 124], [px + 84, 98]], 'var(--jr-snow)');
  shape(ground, [[px, py], [px + 84, 98], [px + 58, 124], [px + 24, 100]], 'var(--jr-snow-2)');
  // The scar the slab leaves behind
  shape(ground, [[px + 40, 120], [px + 110, 132], [px + 170, 190], [px + 120, 186]], 'var(--stone-d)', { opacity: 0.6 });

  // The slide: blocks of snow and a cloud of powder, which run down the face once the wolf arrives
  const slide = el('g', {}, ground);
  for (let i = 0; i < 16; i++) {
    const t = i / 15, bx = px + 110 + t * 190 + (rnd() - 0.5) * 30, by = 150 + t * (gy - 160) + (rnd() - 0.5) * 16, s = 7 + rnd() * 12;
    shape(slide, [[bx - s, by + s * 0.5], [bx - s * 0.5, by - s * 0.6], [bx + s * 0.6, by - s * 0.5], [bx + s, by + s * 0.4], [bx + s * 0.2, by + s * 0.8]], i % 3 ? 'var(--jr-snow)' : 'var(--jr-snow-2)');
  }
  for (let i = 0; i < 5; i++) el('circle', { cx: px + 250 + i * 34, cy: gy - 16 - (i % 2) * 14, r: 20 + (i % 3) * 7, fill: 'var(--jr-snow)', opacity: 0.35 }, slide);
  props.push({ el: slide, x: px + 60, layer: 1, kind: 'slide' });

  for (let x = x0 + 30; x < x1 - 20; x += 110 + rnd() * 120) if (x < px - 150 || x > px + 340) pine(ground, x, gy, 38 + rnd() * 26, true);
  return { props };
};
