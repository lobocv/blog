// Interaction for SystemDiagram: before/after toggle, detail panel, and flow playback.
import type { Flow } from '../lib/diagram';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export function initDiagram(root: HTMLElement) {
  const flows: Flow[] = JSON.parse(root.dataset.flows ?? '[]');
  const bar = root.querySelector<HTMLElement>('.sysdiag-bar')!;
  const svg = root.querySelector<SVGSVGElement>('.sysdiag-svg')!;
  const caption = root.querySelector<HTMLElement>('.sysdiag-caption')!;
  const intro = root.querySelector<HTMLElement>('.panel-intro')!;
  const detail = root.querySelector<HTMLElement>('.panel-detail')!;
  const title = detail.querySelector<HTMLElement>('.panel-title')!;
  const body = detail.querySelector<HTMLElement>('.panel-body')!;
  const more = detail.querySelector<HTMLAnchorElement>('.panel-more')!;
  const pulses = svg.querySelector<SVGGElement>('.pulses')!;
  const nodes = [...svg.querySelectorAll<SVGGElement>('.node')];
  bar.hidden = false;

  // Views
  const setView = (view: string) => {
    root.dataset.view = view;
    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-view-btn]')) b.setAttribute('aria-pressed', String(b.dataset.viewBtn === view));
    for (const g of svg.querySelectorAll<SVGGElement>('.edges, .groups')) g.toggleAttribute('data-off', g.dataset.view !== view);
    for (const n of nodes) {
      const pos = n.dataset[view === 'after' ? 'posAfter' : 'posBefore'];
      n.toggleAttribute('data-absent', !pos);
      if (pos) {
        const [x, y] = pos.split(',');
        n.style.transform = `translate(${x}px, ${y}px)`;
      }
      if (n.dataset.detail) n.tabIndex = pos ? 0 : -1;
    }
    if (view !== 'after') stop();
  };
  for (const b of root.querySelectorAll<HTMLButtonElement>('[data-view-btn]')) b.addEventListener('click', () => setView(b.dataset.viewBtn!));

  // Detail panel: shows a copy of the matching Detail block from the page
  let selected: SVGGElement | null = null;
  const close = () => {
    detail.hidden = true;
    intro.hidden = false;
    selected?.classList.remove('selected');
    selected = null;
  };
  const open = (n: SVGGElement) => {
    const id = n.dataset.detail!;
    const src = document.getElementById(`detail-${id}`) as HTMLDetailsElement | null;
    if (!src) return;
    selected?.classList.remove('selected');
    selected = n;
    n.classList.add('selected');
    title.textContent = src.querySelector('summary h3')?.textContent ?? '';
    body.replaceChildren(...[...src.querySelector('.detail-body')!.children].map(c => c.cloneNode(true)));
    more.href = `#detail-${id}`;
    intro.hidden = true;
    detail.hidden = false;
    // On phones the panel sits below the diagram; bring it into view
    if (matchMedia('(max-width: 900px)').matches) detail.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'nearest' });
  };
  for (const n of nodes) {
    if (!n.dataset.detail) continue;
    n.addEventListener('click', () => (selected === n ? close() : open(n)));
    n.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); n.dispatchEvent(new MouseEvent('click')); }
    });
  }
  detail.querySelector('.panel-close')!.addEventListener('click', close);
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { close(); stop(); } });
  more.addEventListener('click', e => {
    e.preventDefault();
    const target = document.querySelector<HTMLDetailsElement>(more.hash);
    if (!target) return;
    target.open = true;
    target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', more.hash);
  });

  // Flow playback: pulses travel along each step's edges, steps play in order
  let run = 0;
  const playBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-flow]')];
  const clearMarks = () => {
    pulses.replaceChildren();
    svg.querySelectorAll('.edge-g.on, .edge-g.done').forEach(g => g.classList.remove('on', 'done'));
    svg.querySelectorAll<SVGPathElement>('path[marker-end*="-on)"]').forEach(p => p.setAttribute('marker-end', p.getAttribute('marker-end')!.replace('-on)', ')')));
    nodes.forEach(n => n.classList.remove('lit'));
  };
  function stop() {
    run++;
    root.classList.remove('playing');
    playBtns.forEach(b => { b.setAttribute('aria-pressed', 'false'); b.querySelector('span')!.textContent = flows[+b.dataset.flow!].label; });
    clearMarks();
    caption.hidden = true;
  }
  const travel = (path: SVGPathElement, ms: number, id: number) => new Promise<void>(resolve => {
    const len = path.getTotalLength();
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '5');
    dot.setAttribute('class', 'pulse');
    pulses.append(dot);
    const t0 = performance.now();
    const tick = (now: number) => {
      if (id !== run) { dot.remove(); return resolve(); }
      const t = Math.min(1, (now - t0) / ms);
      const eased = t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const p = path.getPointAtLength(eased * len);
      dot.setAttribute('cx', String(p.x));
      dot.setAttribute('cy', String(p.y));
      if (t < 1) requestAnimationFrame(tick);
      else { dot.remove(); resolve(); }
    };
    requestAnimationFrame(tick);
  });
  const play = async (i: number, btn: HTMLButtonElement) => {
    if (root.classList.contains('playing')) { stop(); return; }
    setView('after');
    close();
    clearMarks();
    const id = ++run;
    root.classList.add('playing');
    btn.setAttribute('aria-pressed', 'true');
    btn.querySelector('span')!.textContent = 'Stop';
    caption.hidden = false;
    const flow = flows[i];
    for (const [k, step] of flow.steps.entries()) {
      if (id !== run) return;
      caption.innerHTML = `<span class="n">${k + 1}/${flow.steps.length}</span> ${step.note}`;
      const groups = step.edges.map(([a, b]) => svg.querySelector<SVGGElement>(`.edges[data-view="after"] [data-key="${a}>${b}"]`)!);
      svg.querySelectorAll('.edge-g.on').forEach(g => { g.classList.remove('on'); g.classList.add('done'); });
      groups.forEach(g => {
        g.classList.add('on');
        const p = g.querySelector('path')!, m = p.getAttribute('marker-end')!;
        if (!m.includes('-on)') && !m.includes('-tangle)')) p.setAttribute('marker-end', m.replace(')', '-on)'));
      });
      step.edges.forEach(([a]) => svg.querySelector(`.node[data-id="${a}"]`)?.classList.add('lit'));
      if (reduced()) await wait(2200);
      else { await Promise.all(groups.map(g => travel(g.querySelector('path')!, 1100, id))); await wait(1100); }
      step.edges.forEach(([, b]) => svg.querySelector(`.node[data-id="${b}"]`)?.classList.add('lit'));
    }
    if (id !== run) return;
    await wait(1400);
    if (id === run) {
      root.classList.remove('playing');
      btn.setAttribute('aria-pressed', 'false');
      btn.querySelector('span')!.textContent = 'Play again';
    }
  };
  playBtns.forEach(b => b.addEventListener('click', () => play(+b.dataset.flow!, b)));
}
