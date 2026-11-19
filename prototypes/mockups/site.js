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
      const leaf = (...a) => leafFn(...a);
      const n = 14, pts = [];
      for (let i = 0; i <= n; i++) { const t = i / n, a = ang + curl * t * t; const p = i ? pts[i - 1] : [x, y, ang]; pts.push(i ? [p[0] + Math.cos(a) * len / n, p[1] + Math.sin(a) * len / n, a] : [x, y, ang]); }
      let d = `M${f(x)},${f(y)}` + pts.map(p => `L${f(p[0])},${f(p[1])}`).join('') + pts.slice().reverse().map(p => `L${f(p[0] + 1)},${f(p[1] + 1)}`).join('') + 'Z';
      for (let i = 1; i < n; i++) {
        const [px, py, a] = pts[i], t = i / n, L2 = len * .2 * Math.pow(1 - t, .7) + 2, w = L2 * .22;
        for (const sgn of [-1, 1]) {
          d += leaf(px, py, L2 * 1.15, a + sgn * 1.0, .38);
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
    // Pointed oval leaf from (x, y) pointing along ang
    function leafFn(...a) { return leaf(...a); }
    function leaf(x, y, len, ang, wid = .42) {
      const c = Math.cos(ang), s = Math.sin(ang), tx = x + c * len, ty = y + s * len, mx = x + c * len * .45, my = y + s * len * .45, w = len * wid;
      return `M${f(x)},${f(y)}Q${f(mx - s * w)},${f(my + c * w)} ${f(tx)},${f(ty)}Q${f(mx + s * w)},${f(my - c * w)} ${f(x)},${f(y)}Z`;
    }
    // A filled strip along a list of points, tapering from w0 to w1
    function ribbon(pts, w0, w1) {
      const L = [], Rr = [];
      pts.forEach((p, i) => {
        const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)], dx = q[0] - o[0], dy = q[1] - o[1], d = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * i / (pts.length - 1)) / 2;
        L.push([p[0] - dy / d * w, p[1] + dx / d * w]); Rr.push([p[0] + dy / d * w, p[1] - dx / d * w]);
      });
      return 'M' + L.concat(Rr.reverse()).map(p => f(p[0]) + ',' + f(p[1])).join('L') + 'Z';
    }
    // Winding vine down the full height, with oval leaves and the odd curling tendril
    function vine(x0, height, ph) {
      const pts = [];
      for (let y = -20; y <= height + 20; y += 8) pts.push([x0 + 22 * Math.sin(y / 150 + ph) + 9 * Math.sin(y / 61 + ph * 2), y]);
      let d = ribbon(pts, 2.4, 2.4), side = 1;
      for (let i = 3; i < pts.length - 1; i += 4 + Math.floor(rng() * 3)) {
        const [px, py] = pts[i], len = 16 + rng() * 14, ang = (side > 0 ? 0 : Math.PI) + side * (.5 + rng() * .5);
        const sx = px + Math.cos(ang) * 6, sy = py + Math.sin(ang) * 6;
        d += ribbon([[px, py], [sx, sy]], 1.2, 1) + leaf(sx, sy, len, ang + side * .2, .48);
        if (rng() < .12) { // tendril
          const tp = []; let a = ang - side * .4, r = 14;
          for (let k = 0; k < 22; k++) { tp.push([px + Math.cos(a) * (14 - r) * 1.4 + Math.cos(ang) * k * .9, py + Math.sin(a) * (14 - r) * 1.4 + Math.sin(ang) * k * .9]); a += side * .45; r *= .93; }
          d += ribbon(tp, 1, .4);
        }
        side = -side;
      }
      return d;
    }
    // Olive-like branch reaching in from the edge, with narrow paired leaves and a side shoot
    function branch(x, y, len, ang, droop) {
      const grow = (x, y, len, ang, droop, w) => {
        const pts = []; let px = x, py = y, a = ang; const n = 16;
        for (let i = 0; i <= n; i++) { pts.push([px, py]); px += Math.cos(a) * len / n; py += Math.sin(a) * len / n; a += droop / n; }
        let d = ribbon(pts, w, .6);
        for (let i = 3; i <= n; i += 2) { const [qx, qy] = pts[i], b = ang + droop * i / n, l = 14 + 10 * (1 - i / n) * rng() + 6; d += leaf(qx, qy, l, b - .9 + rng() * .2, .26) + leaf(qx, qy, l, b + .9 - rng() * .2, .26); }
        d += leaf(pts[n][0], pts[n][1], 16, ang + droop, .26);
        return { d, pts };
      };
      const main = grow(x, y, len, ang, droop, 3.2);
      const at = main.pts[7];
      return main.d + grow(at[0], at[1], len * .45, ang + droop * .4 - .7, droop * .6, 1.8).d;
    }
    return { rng, f, pine, ridge, yAt, fern, sprig, leaf, ribbon, vine, branch };
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

    // Grass and bushes on the cliff ledge; the rock carries on and fades into the content
    foliageBand(el) {
      const g = gen(23), { rng, f, leaf } = g, W = 1600, H = 230, EDGE = 140;
      const soilTop = x => EDGE - 34 + Math.sin(x / 170) * 6 + Math.sin(x / 53 + 1) * 3;
      // soil with a little texture: pebbles and specks
      let soil = `M0,${H}`; for (let x = 0; x <= W; x += 10) soil += `L${x},${f(soilTop(x))}`; soil += `L${W},${H}Z`;
      let dark = '', light = '';
      for (let x = -60; x < W + 60; x += 110 + rng() * 160) {   // large, low-contrast facets like the cliff face
        const t = soilTop(x), w = 90 + rng() * 140, h = 40 + rng() * 40, tip = x + w * (.3 + rng() * .5);
        const d = `M${f(x)},${f(t + 2)}L${f(x + w)},${f(soilTop(x + w) + 2)}L${f(tip)},${f(t + h)}Z`;
        if (rng() < .5) dark += d; else light += d;
      }
      for (let i = 0; i < 40; i++) {   // a few small stones
        const x = rng() * W, y = soilTop(x) + 6 + rng() * 60, rx = .8 + rng() * 2.6, ry = rx * (.5 + rng() * .4);
        const d = `M${f(x - rx)},${f(y)}A${f(rx)},${f(ry)} 0 1 1 ${f(x + rx)},${f(y)}A${f(rx)},${f(ry)} 0 1 1 ${f(x - rx)},${f(y)}Z`;
        if (rng() < .5) dark += d; else light += d;
      }
      // grass: tufts of curved blades along the soil line, with small gaps
      let grassBack = '', grassFront = '';
      for (let x = -10; x < W + 10; x += 2.5 + rng() * 4) {
        if (Math.sin(x / 37) + Math.sin(x / 91) < -1.5) continue;   // occasional bare patches
        const blades = 2 + Math.floor(rng() * 4);
        for (let k = 0; k < blades; k++) {
          const bx = x + (rng() - .5) * 6, by = soilTop(bx) + 3, h = 12 + Math.pow(rng(), 1.4) * 38, lean = (rng() - .5) * h * .8, w = 1.2 + rng() * 1.3;
          const d = `M${f(bx - w)},${f(by)}Q${f(bx + lean * .3)},${f(by - h * .6)} ${f(bx + lean)},${f(by - h)}Q${f(bx + lean * .3 + w * .4)},${f(by - h * .55)} ${f(bx + w)},${f(by)}Z`;
          if (rng() < .45) grassBack += d; else grassFront += d;
        }
      }
      // a few bushes resting on the soil
      const tones = ['', '', '', ''];
      const bush = (cx, r) => {
        const cy = soilTop(cx) - r * .42;
        tones[0] += `M${f(cx - r)},${f(cy + r * .42)}A${f(r)},${f(r * .78)} 0 0 1 ${f(cx + r)},${f(cy + r * .42)}Z`;
        for (let i = 0; i < r * 1.8; i++) {
          const t = -Math.PI * (1.04 * rng() - .02), rr = r * (.3 + .7 * Math.sqrt(rng())), x = cx + Math.cos(t) * rr, y = cy + Math.sin(t) * rr * .78 + r * .1;
          if (y > soilTop(x) + 2) continue;
          const ang = t + (rng() - .5) * .9, len = 8 + rng() * 11, k = rng() < .3 ? 1 : rng() < .8 ? 2 : 3;
          tones[k] += leaf(x - Math.cos(ang) * len * .3, y - Math.sin(ang) * len * .3, len, ang, .46);
        }
      };
      let x = 20 + rng() * 60;
      while (x < W + 40) { bush(x, 24 + rng() * 32); if (rng() < .5) bush(x + 30 + rng() * 20, 16 + rng() * 14); x += 90 + rng() * 130; }
      el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
        <path d="${grassBack}" fill="var(--grass1)"/>
        <path d="${soil}" fill="var(--soil)"/><path d="${dark}" fill="var(--soil-2)"/><path d="${light}" fill="var(--soil-3)"/>
        <path d="M0,${f(soilTop(0))}${Array.from({ length: 161 }, (_, i) => `L${i * 10},${f(soilTop(i * 10))}`).join('')}" fill="none" stroke="var(--rim)" stroke-width="1.2" opacity=".55"/>
        <path d="${tones[0]}" fill="var(--fol1)"/><path d="${tones[1]}" fill="var(--fol1b)"/><path d="${tones[2]}" fill="var(--fol2)"/><path d="${tones[3]}" fill="var(--fol3)"/>
        <path d="${grassFront}" fill="var(--grass2)"/></svg>`;
    },

    // Faint vines, branches and ferns running down both side margins
    sideFoliage(el, height) {
      const g = gen(37), { rng } = g, W = 260;
      const column = (mirror, ph) => {
        let d = g.vine(26, height, ph), kind = mirror ? 1 : 0;
        for (let y = 140 + rng() * 120; y < height - 160; y += 420 + rng() * 240) {
          if (kind % 2 === 0) d += g.branch(-4, y, 150 + rng() * 60, .15 + rng() * .3, .5 + rng() * .4);
          else for (let i = 0; i < 2; i++) d += g.fern(-6, y + i * 40, 110 + rng() * 80, .2 + rng() * .4, .3 + rng() * .4);
          kind++;
        }
        return `<svg class="side ${mirror ? 'right' : 'left'}" viewBox="0 0 ${W} ${height}" width="${W}" height="${height}" aria-hidden="true"><path d="${d}"/></svg>`;
      };
      el.innerHTML = column(false, 0) + column(true, 2.1);
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
