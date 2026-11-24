// The journey scene: a pinned SVG landscape whose camera follows the chapter being read.
// Chapter i spans world x = START + i * GAP to the next chapter, the same stretch the wolf covers while it is read. Layers move at 0.3 (far), 0.6 (mid) and 1 (ground);
// the wolf stays at WOLF_X and its stride follows the distance scrolled (backwards when scrolling up).
import { TIMELINE } from '../../data/timeline';
import { ageAt, cameraPos } from '../../lib/timeline';
import { el, GROUND_Y, layerX, WOLF_X } from './kit';
import { SCENES, type Follow, type Prop, type SceneLayers } from './scenes';
import { drawWolf, poseWolf, strideLength } from './wolf';

export const GAP = 700;
const START = 600;
// The drawings already grow with age; this only adds a little extra size on top
const AGE_SCALE = [1.1, 1.15, 1.2, 1.2];
const NEAR = 560;


export function initJourney(root: HTMLElement): void {
  const stage = root.querySelector<HTMLElement>('#jr-stage')!;
  const svg = root.querySelector<SVGSVGElement>('#jr-svg')!;
  const rows = [...root.querySelectorAll<HTMLElement>('.jr-row')];
  const hudWhen = root.querySelector('#jr-when')!, hudEra = root.querySelector('#jr-era')!;
  const { chapters } = TIMELINE;
  if (!rows.length) return;
  document.documentElement.classList.add('jr-on');

  // --- Build the world once
  const layers: SceneLayers = { far: el('g', {}, svg), mid: el('g', {}, svg), ground: el('g', {}, svg) };
  const worldEnd = START + chapters.length * GAP + 1600;
  backdrop(layers, worldEnd);
  const props: Prop[] = [], follow: Follow[] = [];
  for (let i = 0; i < chapters.length;) {
    let j = i; while (j + 1 < chapters.length && chapters[j + 1].scene === chapters[i].scene) j++;
    const chapterX = chapters.slice(i, j + 1).map((_, k) => START + (i + k) * GAP);
    const drawn = SCENES[chapters[i].scene](layers, { x0: chapterX[0], x1: chapterX.at(-1)! + GAP, chapterX });
    props.push(...(drawn.props ?? []));
    follow.push(...(drawn.follow ?? []));
    i = j + 1;
  }
  for (const p of props) p.el.classList.add(p.kind === 'draw' ? 'jr-draw' : p.kind === 'slide' ? 'jr-slide' : 'jr-prop');
  const followG = el('g', { transform: `translate(${WOLF_X},${GROUND_Y})` }, svg);
  for (const f of follow) { followG.appendChild(f.el); f.el.classList.add('jr-follow'); }
  const wolfG = el('g', {}, svg);
  const wolf = drawWolf(wolfG);

  // --- Scroll → camera
  let tops: number[] = [], lastBottom = 0;
  const measure = () => {
    tops = rows.map(r => r.getBoundingClientRect().top + scrollY);
    const last = rows.at(-1)!;
    lastBottom = tops.at(-1)! + last.offsetHeight + 200;
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let target = 0, pos = 0, cam = 0, cycle = 0, active = -1, running = false, stopTimer = 0;
  const ages = chapters.map(c => c.age as number);

  const read = () => {
    const h = stage.offsetHeight + stage.getBoundingClientRect().top;
    const r = cameraPos(tops, scrollY + h + (innerHeight - h) * 0.35, lastBottom);
    pos = r.pos;
    target = START + pos * GAP - WOLF_X;
    if (r.index !== active) {
      active = r.index;
      rows.forEach((row, k) => row.classList.toggle('active', k === active));
      hudWhen.textContent = chapters[active].when;
      hudEra.textContent = chapters[active].era;
    }
  };

  // Stop-motion: every frame is a pure function of scroll. The camera follows scroll exactly, the
  // stride advances by distance travelled (so paws never slide), and when scrolling stops the scene
  // freezes where it is, mid-stride or not.
  const frame = () => {
    running = false;
    const d = target - cam;
    cam = target;
    const age = ageAt(ages, pos);
    const lo = Math.floor(age), s = AGE_SCALE[lo] + (AGE_SCALE[Math.min(3, lo + 1)] - AGE_SCALE[lo]) * (age - lo);
    cycle += d / (strideLength(age) * s);

    layers.far.setAttribute('transform', `translate(${-cam * 0.3},0)`);
    layers.mid.setAttribute('transform', `translate(${-cam * 0.6},0)`);
    layers.ground.setAttribute('transform', `translate(${-cam},0)`);
    wolfG.setAttribute('transform', `translate(${WOLF_X},${GROUND_Y}) scale(${s})`);
    poseWolf(wolf, cycle, reduce.matches ? 0 : 1, age);
    for (const p of props) {
      const dx = p.x - cam * p.layer - WOLF_X;
      p.el.classList.toggle('in', p.kind === 'draw' || p.kind === 'slide' ? dx <= 0 && dx > -GAP * 2 : Math.abs(dx) < NEAR);
    }
    const wx = cam + WOLF_X;
    for (const f of follow) f.el.classList.toggle('in', wx >= f.x0 && wx <= f.x1);
    // Effects that loop on their own (radar pulses) only play while the scene is moving
    if (d !== 0) {
      stage.classList.add('moving');
      clearTimeout(stopTimer);
      stopTimer = window.setTimeout(() => stage.classList.remove('moving'), 160);
    }
  };
  const wake = () => { if (!running && !document.hidden) { running = true; requestAnimationFrame(frame); } };

  const seen = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('seen')), { threshold: 0.1 });
  rows.forEach(r => seen.observe(r));
  addEventListener('scroll', () => { read(); wake(); }, { passive: true });
  // Re-measure when the layout changes (resize, fonts, a side item opening) without jumping the camera
  new ResizeObserver(() => { measure(); read(); wake(); }).observe(root);
  document.addEventListener('visibilitychange', wake);

  measure(); read(); cam = target; wake();
}

/** Far ridges and mid hills that run the whole width of the world, behind every scene */
function backdrop({ far, mid, ground }: SceneLayers, worldEnd: number) {
  let seed = 20131;
  const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ridge = (layer: SVGGElement, k: number, y: number, amp: number, step: number, fill: string) => {
    const x0 = layerX(-1200, k), x1 = layerX(worldEnd, k) + 1600;
    let d = `M${x0},${GROUND_Y + 10}`;
    for (let x = x0; x <= x1; x += step) d += `L${x.toFixed(0)},${(y - rng() * amp).toFixed(0)}`;
    el('path', { d: d + `L${x1},${GROUND_Y + 10}Z`, fill }, layer);
  };
  ridge(far, 0.3, 190, 90, 70, 'var(--r2)');
  ridge(mid, 0.6, 236, 45, 55, 'var(--r3)');
  el('rect', { x: -1600, y: GROUND_Y, width: worldEnd + 3200, height: 400 - GROUND_Y + 20, fill: 'var(--soil)' }, ground);
  el('rect', { x: -1600, y: GROUND_Y - 4, width: worldEnd + 3200, height: 8, fill: 'var(--turf-n)' }, ground);
}
