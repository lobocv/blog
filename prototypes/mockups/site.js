// Shared behaviour for the blog mockups: post data, day/night theme, horizon band.
(() => {
  const POSTS = [
    { slug: 'golang_testing', title: 'Testing complex workflows in Go', date: '2022-10-01', cats: ['Golang'], mins: 9,
      summary: 'A testify/suite style that keeps sophisticated fixtures, mocks, edge cases and complex outputs readable as the test cases multiply.' },
    { slug: 'richer_golang_errors', title: 'Advanced Go Error Handling Made Simple', date: '2022-03-22', cats: ['Golang'], mins: 15,
      summary: 'Go handles errors explicitly. Here is how to carry richer context through your errors without giving up that simplicity.' },
    { slug: 'elasticsearch_slots', title: 'Defusing an ElasticSearch Mapping Explosion with Slots', date: '2021-12-12', cats: ['Databases'], mins: 8,
      summary: 'When user-defined fields threaten to blow up your index mapping, a fixed set of reusable slots keeps it under control.' },
    { slug: 'event_folding', title: 'Reducing System Load With Event Folding', date: '2021-08-01', cats: ['Architecture'], mins: 12,
      summary: 'Collapsing bursts of redundant events into a single unit of work, and the maths behind how much load it saves.' },
    { slug: 'dev_environment', title: 'Building a Comfortable Dev Environment', date: '2021-07-06', cats: ['Developer Efficiency'], mins: 8,
      summary: 'The tools, aliases and habits that make the daily grind of git, docker, kubectl and friends feel effortless.' },
    { slug: 'recursive_jsonb_merge', title: 'Recursively Merging JSONB in PostgreSQL', date: '2021-05-01', cats: ['Databases'], mins: 5,
      summary: 'PostgreSQL merges JSONB one level deep. A small recursive function merges nested documents all the way down.' }
  ];

  function gen(seed) {
    const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const f = n => Math.round(n * 10) / 10;
    const W = 1600;
    function mpd(n, rough) {
      const a = new Array(n + 1).fill(0); a[0] = rng() * 2 - 1; a[n] = rng() * 2 - 1;
      let step = n, scale = 1;
      while (step > 1) { const h = step / 2; for (let i = h; i < n; i += step) a[i] = (a[i - h] + a[i + h]) / 2 + (rng() * 2 - 1) * scale; scale *= rough; step = h; }
      const m = Math.max(...a.map(Math.abs)); return a.map(v => v / m);
    }
    function ridge(y0, amp, rough, bottom) {
      const n = 128, a = mpd(n, rough), pts = a.map((v, i) => [i * W / n, y0 + v * amp]);
      return { pts, d: `M0,${bottom}` + pts.map(p => `L${f(p[0])},${f(p[1])}`).join('') + `L${W},${bottom}Z` };
    }
    const yAt = (pts, x) => { const s = W / (pts.length - 1), i = Math.max(0, Math.min(pts.length - 2, Math.floor(x / s))), t = (x - pts[i][0]) / s; return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t; };
    // Varied tiered pine; returns [silhouette, lit right half]
    function pine(x, y, h) {
      const tiers = 2 + Math.floor(rng() * 3), w = h * (.28 + rng() * .14), lean = (rng() - .5) * .08;
      const side = sgn => { const pts = []; for (let k = 1; k <= tiers; k++) { const t = k / tiers, ty = -1 + t * .92 + (rng() - .5) * .04, out = w * Math.pow(t, .8) * (.85 + rng() * .3); pts.push([sgn * out + lean * (1 + ty) * h, ty]); if (k < tiers) pts.push([sgn * out * (.42 + rng() * .15) + lean * (1 + ty) * h, ty + .02]); } return pts; };
      const L = side(-1), R = side(1), P = ([px, py]) => f(x + px) + ',' + f(y + py * h);
      const dark = 'M' + [[0, -1], ...L, [-w * .08, -.06], [-w * .08, 0], [w * .08, 0], [w * .08, -.06], ...R.slice().reverse()].map(P).join('L') + 'Z';
      const lit = 'M' + [[0, -1], ...R, [w * .1, -.06], [lean * .5 * h, -.5]].map(P).join('L') + 'Z';
      return [dark, lit];
    }
    // Fern frond: a curving stem with leaflets that shrink toward the tip
    function fern(x, y, len, ang, curl) {
      const n = 14, pts = [];
      for (let i = 0; i <= n; i++) { const t = i / n, a = ang + curl * t * t; const p = i ? pts[i - 1] : [x, y, ang]; pts.push(i ? [p[0] + Math.cos(a) * len / n, p[1] + Math.sin(a) * len / n, a] : [x, y, ang]); }
      let d = `M${f(x)},${f(y)}` + pts.map(p => `L${f(p[0])},${f(p[1])}`).join('') + pts.slice().reverse().map(p => `L${f(p[0] + 1)},${f(p[1] + 1)}`).join('') + 'Z';
      for (let i = 1; i < n; i++) {
        const [px, py, a] = pts[i], t = i / n, L2 = len * .2 * Math.pow(1 - t, .7) + 2, w = L2 * .22;
        for (const sgn of [-1, 1]) {
          const la = a + sgn * 1.05, tx = px + Math.cos(la) * L2, ty = py + Math.sin(la) * L2;
          d += `M${f(px - Math.cos(a) * w)},${f(py - Math.sin(a) * w)}L${f(tx)},${f(ty)}L${f(px + Math.cos(a) * w)},${f(py + Math.sin(a) * w)}Z`;
        }
      }
      return d;
    }
    // Hanging sprig: a gently drooping branch with small oval leaves
    function sprig(x, y, len, droop) {
      let d = '', px = x, py = y, a = .1;
      for (let i = 0; i < 12; i++) {
        const nx = px + Math.cos(a) * len / 12, ny = py + Math.sin(a) * len / 12;
        d += `M${f(px)},${f(py)}L${f(nx)},${f(ny)}L${f(nx)},${f(ny + 1.4)}L${f(px)},${f(py + 1.4)}Z`;
        if (i > 1) for (const sgn of [-1, 1]) { const la = a + sgn * .9, r = 9 * (1 - i / 14); d += `M${f(nx)},${f(ny)}Q${f(nx + Math.cos(la - .3) * r)},${f(ny + Math.sin(la - .3) * r)} ${f(nx + Math.cos(la) * r * 1.7)},${f(ny + Math.sin(la) * r * 1.7)}Q${f(nx + Math.cos(la + .3) * r)},${f(ny + Math.sin(la + .3) * r)} ${f(nx)},${f(ny)}Z`; }
        px = nx; py = ny; a += droop * .12;
      }
      return d;
    }
    return { rng, f, pine, ridge, yAt, fern, sprig };
  }
  const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const row = p => `<a class="row" href="post.html" data-cats="${p.cats.join('|')}">
      <time class="meta" datetime="${p.date}">${fmt(p.date)}</time>
      <div><h3>${p.title}</h3><p>${p.summary}</p>
        <div class="tags">${p.cats.map(c => `<span class="tag">#${c.toLowerCase().replace(/ /g, '-')}</span>`).join('')}<span class="meta">${p.mins} min read</span></div></div>
      <span class="arrow" aria-hidden="true">→</span></a>`;

  // Theme: a saved choice wins, otherwise the visitor's local time
  const saved = (() => { try { return localStorage.getItem('time'); } catch { return null; } })();
  const forced = new URLSearchParams(location.search).get('time');
  const h = new Date().getHours();
  const initial = forced || saved || (h >= 7 && h < 19 ? 'day' : 'night');
  const apply = t => { document.documentElement.dataset.time = t; const b = document.getElementById('toggle'); if (b) b.setAttribute('aria-label', t === 'day' ? 'Switch to night' : 'Switch to day'); };
  apply(initial);

  window.Site = {
    POSTS, fmt, row,
    save(t) { try { localStorage.setItem('time', t); } catch {} },
    initTheme() {
      const b = document.getElementById('toggle'); if (!b) return;
      apply(document.documentElement.dataset.time);
      b.addEventListener('click', () => { const t = document.documentElement.dataset.time === 'day' ? 'night' : 'day'; apply(t); Site.save(t); });
    },
    // Landscape header in the hero's style. Colors come from CSS variables, so it follows the theme.
    horizon(el) {
      const g = gen(11), { rng, f, pine, ridge } = g, W = 1600, H = 300;
      let stars = '';
      for (let i = 0; i < 90; i++) stars += `<circle cx="${f(rng() * W)}" cy="${f(Math.pow(rng(), 1.3) * 190)}" r="${f(.4 + rng() * .8)}" opacity="${(.3 + rng() * .6).toFixed(2)}"/>`;
      // Mid ridge with a dense row of small pines on its crest
      const mid = ridge(212, 10, .6, H);
      let midTrees = '';
      for (let x = -10; x < W + 10; x += 3 + rng() * 4) midTrees += pine(x, g.yAt(mid.pts, x) + 3, 7 + rng() * 8)[0];
      // Foreground treeline: bigger varied pines with a lit side and a thin outline
      const near = [];
      for (let x = -20; x < W + 20; x += 9 + rng() * 12) near.push([x, 268 + Math.sin(x / 160) * 6 + rng() * 6, 26 + rng() * 34]);
      near.sort((p, q) => p[1] - q[1]);
      let nearSvg = '';
      for (const [x, y, h] of near) { const [d, l] = pine(x, y, h); nearSvg += `<path d="${d}" class="t"/><path d="${l}" class="tl"/>`; }
      el.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs><filter id="hglow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="24"/></filter><filter id="hblur" x="-50%" y="-300%" width="200%" height="700%"><feGaussianBlur stdDeviation="10"/></filter></defs>
        <g class="night-only" fill="var(--star)">${stars}</g>
        <circle cx="1300" cy="78" r="44" fill="var(--glow)" opacity=".5" filter="url(#hglow)"/>
        <circle cx="1300" cy="78" r="24" fill="var(--orb)"/>
        <g class="night-only" fill="var(--crater)"><circle cx="1293" cy="73" r="5"/><circle cx="1307" cy="86" r="3.4"/><circle cx="1304" cy="68" r="2.2"/></g>
        <path d="${ridge(150, 34, .55, H).d}" fill="var(--r1)"/>
        <path d="${ridge(188, 24, .52, H).d}" fill="var(--r2)"/>
        <ellipse cx="500" cy="214" rx="520" ry="10" fill="var(--mist)" opacity=".35" filter="url(#hblur)"/>
        <path d="${mid.d}" fill="var(--r3)"/><path d="${midTrees}" fill="var(--r3)"/>
        <rect x="0" y="262" width="${W}" height="40" fill="var(--tree)"/>
        <g class="trees">${nearSvg}</g>
        <path d="M0,${H} L0,290 Q400,280 800,290 T1600,286 L1600,${H} Z" fill="var(--r4)"/></svg>`);
    },

    // Foreground foliage that breaks up the edge between the hero and the content
    foliageBand(el) {
      const g = gen(23), { rng, f, pine } = g, W = 1600, H = 250;
      let back = '', mid = '', front = '';
      // back: tall pine tops poking up
      for (let x = -20; x < W + 20; x += 50 + rng() * 90) back += pine(x, 186, 60 + rng() * 90)[0];
      // mid: rounded shrubs and ferns
      for (let x = -40; x < W + 40; x += 55 + rng() * 60) {
        const r = 22 + rng() * 30, y = 128 + rng() * 26;
        mid += `M${f(x - r)},${f(y + r)}A${f(r)},${f(r * .8)} 0 0 1 ${f(x + r)},${f(y + r)}Z`;
        if (rng() < .6) mid += g.fern(x + (rng() - .5) * 40, 184, 70 + rng() * 60, -Math.PI / 2 + (rng() - .5) * 1.1, (rng() - .5) * .9);
      }
      // front: grasses and fern fronds, plus a solid base that hides the content's straight top edge
      for (let x = -20; x < W + 20; x += 7 + rng() * 9) {
        const h = 22 + rng() * 40, lean = (rng() - .5) * 20, y = 182 + rng() * 8;
        front += `M${f(x - 2.5)},${f(y)}Q${f(x + lean * .4)},${f(y - h * .6)} ${f(x + lean)},${f(y - h)}Q${f(x + lean * .3 + 1.5)},${f(y - h * .55)} ${f(x + 2.5)},${f(y)}Z`;
      }
      for (let x = -30; x < W + 30; x += 70 + rng() * 90) front += g.fern(x, 190, 50 + rng() * 45, -Math.PI / 2 + (rng() < .5 ? -1 : 1) * (.5 + rng() * .5), (rng() - .5) * 1.2);
      el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <path d="${back}" fill="var(--fol1)"/><path d="${mid}" fill="var(--fol2)"/>
        <path d="M0,${H}L0,182${Array.from({ length: 41 }, (_, i) => `L${i * 40},${f(174 + Math.sin(i * 1.7) * 4 + Math.sin(i * .6) * 3)}`).join('')}L${W},${H}Z" fill="var(--fol3)"/><path d="${front}" fill="var(--fol3)"/></svg>`;
    },

    // Faint ferns and branches running down both side margins
    sideFoliage(el, height) {
      const g = gen(37), { rng } = g, W = 260;
      const column = mirror => {
        let d = '';
        for (let y = 60; y < height - 100; y += 380 + rng() * 260) {
          const n = 2 + Math.floor(rng() * 3);
          for (let i = 0; i < n; i++) d += g.fern(-6, y + i * 34 + rng() * 30, 120 + rng() * 110, .15 + rng() * .55, .25 + rng() * .5);
          if (rng() < .6) d += g.sprig(-4, y + 160 + rng() * 80, 140 + rng() * 60, .5 + rng() * .4);
        }
        return `<svg class="side ${mirror ? 'right' : 'left'}" viewBox="0 0 ${W} ${height}" width="${W}" height="${height}" aria-hidden="true"><path d="${d}"/></svg>`;
      };
      el.innerHTML = column(false) + column(true);
    },

    // Very faint contour lines, like a topographic map, behind the content
    topo(el, width, height) {
      const g = gen(51), { rng, f } = g;
      let d = '';
      const spots = Math.max(2, Math.round(height / 700));
      for (let s = 0; s < spots; s++) {
        const cx = rng() * width, cy = (s + .5) * height / spots + (rng() - .5) * 200, ph = rng() * 6;
        for (let k = 1; k <= 9; k++) {
          const r = k * 46;
          d += 'M';
          for (let a = 0; a <= 64; a++) {
            const t = a / 64 * Math.PI * 2, wob = 1 + .16 * Math.sin(t * 3 + ph + k * .3) + .08 * Math.sin(t * 5 - ph);
            d += `${f(cx + Math.cos(t) * r * wob * 1.5)},${f(cy + Math.sin(t) * r * wob)}${a < 64 ? 'L' : 'Z'}`;
          }
        }
      }
      el.innerHTML = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true"><path d="${d}"/></svg>`;
    }
  };
})();
