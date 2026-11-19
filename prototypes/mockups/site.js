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
    // Layered ridges + treeline whose colors come from CSS variables, so they follow the theme
    horizon(el) {
      let seed = 11; const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
      const W = 1600, H = 300, ridge = (y0, amp, f1, f2, ph) => {
        let d = `M0,${H}`; for (let x = 0; x <= W; x += 20) d += `L${x},${(y0 + amp * (Math.sin(x / f1 + ph) * .6 + Math.sin(x / f2 + ph * 2) * .4)).toFixed(1)}`;
        return d + `L${W},${H}Z`;
      };
      let trees = '';
      for (let x = -10; x < W + 10; x += 5 + rng() * 6) {
        const base = 262 + Math.sin(x / 140) * 8, th = 18 + rng() * 22, w = th * .34;
        trees += `M${x.toFixed(1)},${(base - th).toFixed(1)}L${(x + w).toFixed(1)},${base.toFixed(1)}L${(x - w).toFixed(1)},${base.toFixed(1)}Z`;
      }
      el.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <circle cx="1300" cy="70" r="26" fill="var(--orb)" opacity=".95"/>
        <path d="${ridge(170, 26, 260, 120, 1)}" fill="var(--r1)"/>
        <path d="${ridge(206, 20, 200, 90, 2.4)}" fill="var(--r2)"/>
        <path d="${trees}" fill="var(--r3)"/><rect x="0" y="258" width="${W}" height="60" fill="var(--r3)"/>
        <path d="M0,${H} L0,286 Q400,270 800,284 T1600,280 L1600,${H} Z" fill="var(--r4)"/></svg>`);
    }
  };
})();
