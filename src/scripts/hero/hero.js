// The wolf hero, ported from prototypes/mockups/home.html with the drawing unchanged.
// Seeds, constants and rng() call order define the art: do not reorder or edit them.
import { flora } from '../art/landscape.js';
import { saveTheme, setThemeHandler } from '../theme';

export function initHero() {
  const W = 1600, BOTTOM = 1500;
  const scene = document.getElementById('scene');
  const f = n => Math.round(n * 10) / 10;

  // Builds the whole scene for one time of day into its own container
  function buildScene(DAY) {
  const host = document.createElement('div'); host.className = 'theme';
  const LAYERS = [];
  // A part of the scene. Plain parts are static artwork; a part with a class (cls) is a sprite that CSS animates as a whole.
  // Neighbouring static parts moving at the same speed are drawn together.
  const layer = (speed, content, o = {}) => { if (!content) return; const last = LAYERS[LAYERS.length - 1]; if (last && last.speed === speed && !o.cls && !last.cls) last.content += content; else LAYERS.push({ speed, content, ...o }); };

  // Seeded RNG so the scene is identical on every load
  let seed = 7;
  const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const lerp = (a, b, t) => a + (b - a) * t;
  // The scene is authored in night colors; the day palette maps each one to its daytime equivalent
  const DAY_PALETTE = {
    // sky, sun
    '#05070f': '#3f7fc6', '#0d1430': '#6ea6dc', '#1f2b55': '#b2d3ec', '#2e3c6c': '#e8efee',
    '#cfdcff': '#fff3cf', '#9fb6ff': '#ffe7a6', '#f2f5ff': '#fffaf0', '#dfe6f8': '#fffaf0', '#e4eaf9': '#fffaf0', '#e1e8f8': '#fffaf0',
    // ridges, haze, mist
    '#2b3866': '#a3bccb', '#212c55': '#86a3b0', '#18214a': '#5f8574', '#8a9dd0': '#ffffff', '#9fb2e0': '#ffffff',
    // terrain + trees
    '#26335f': '#6f8f74', '#2a3a68': '#86a585', '#080d19': '#2d4a2b', '#4a5d94': '#cdd07a', '#04070e': '#1b2b1b',
    '#1f2c55': '#5a7b5b', '#33467a': '#93a865', '#0f1830': '#3d5c30',
    '#0b1226': '#25391f', '#020409': '#101b0f', '#3b4f6e': '#7f9d55', '#4a6194': '#bac873',
    // river
    '#b6c6ee': '#dcefF8'.toLowerCase(), '#22325c': '#3a77a8', '#e6edff': '#ffffff',
    // rock + framing pines
    '#070b14': '#2a2724', '#111a2e': '#5d564c', '#0c1323': '#403a33', '#0a101d': '#35302a', '#5a6ea6': '#d2c19c', '#04070d': '#1e2f20',
    // wolf
    '#0a101e': '#3b342c', '#060a13': '#29231d', '#22345e': '#6d5f4d', '#2e4274': '#887760', '#2b3e6e': '#917f65', '#1b2a4e': '#5a4c3d',
    '#1c2b50': '#4a3e32', '#6d83c0': '#dcc7a2', '#172441': '#5b4f41', '#2c3e6c': '#9c8b70', '#121c34': '#463c31', '#1d2d54': '#6b5c4a',
    '#1a2747': '#605344',
    '#101a30': '#3f6534', '#18253f': '#5a8645', '#0b1222': '#2c4529', '#111b30': '#365232', '#18243f': '#46693d', '#22325a': '#64894b', '#0f1729': '#4b5a3b', '#03050a': '#1c1916', '#1f2d52': '#6c5d4b', '#141f3a': '#4c4134', '#c9d6fa': '#fff2d2', '#93a7dc': '#e8d4ac',
    // ground: soil, path, turf bands (far to near), stones, plants
    '#0c0f18': '#5a4632', '#090c13': '#4a3828', '#1a2136': '#c2ad85', '#222a42': '#d6c6a2', '#151b2c': '#ab966f',
    '#14203a': '#5c8742', '#111c33': '#507a3b', '#0f182c': '#466f35', '#0c1424': '#3d6430', '#0a111f': '#36592b',
    '#1b2338': '#8f877a', '#121829': '#6b645a', '#283250': '#b3ab9b', '#1c2c4a': '#6f9a50', '#0b1220': '#467034', '#2a3d6c': '#7fa35a', '#172543': '#628d45',
    '#131829': '#93795a', '#1e263c': '#dccfb0', '#0e121c': '#735a40', '#191f31': '#bfae8b', '#121727': '#9a8462',
    // the wolf's rock
    '#131d33': '#665e53', '#162138': '#70675a', '#0f172a': '#554e45', '#0d1425': '#3d3730', '#080d18': '#2c2823', '#101829': '#4a433b', '#0a1120': '#38332d', '#0b111f': '#463f37',
    // framing pines
    '#070c18': '#27402a', '#0c1626': '#3a5a34', '#0a0d14': '#33281e', '#10141d': '#4d3d2c'
  };
  // Night keeps the authored colors' lightness but shifts them 7° away from violet and to 75% saturation,
  // to match the night tokens in site.css
  const NIGHT = {};
  const toNight = c => NIGHT[c] || (NIGHT[c] = (() => {
    let [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return c;
    const s = (l > .5 ? d / (2 - mx - mn) : d / (mx + mn)) * .75;
    const h = ((mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 - 7 + 360) % 360;
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    return '#' + [0, 8, 4].map(n => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))) * 255).toString(16).padStart(2, '0')).join('');
  })());
  const K = c => DAY ? (DAY_PALETTE[c] || c) : toNight(c);
  const recolor = str => str.replace(/#[0-9a-f]{6}\b/g, K);
  const mix = (c1, c2, t) => {
    const p = c => c[0] === '#' ? [1,3,5].map(i => parseInt(c.slice(i, i+2), 16)) : c.slice(4, -1).split(',').map(Number);
    const a = p(K(c1)), b = p(K(c2));
    return 'rgb(' + a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',') + ')';
  };
  const f = n => Math.round(n * 10) / 10;

  // Midpoint displacement for natural ridgelines
  function mpd(n, rough) {
    const a = new Array(n + 1).fill(0);
    a[0] = rng() * 2 - 1; a[n] = rng() * 2 - 1;
    let step = n, scale = 1;
    while (step > 1) {
      const h = step / 2;
      for (let i = h; i < n; i += step) a[i] = (a[i - h] + a[i + h]) / 2 + (rng() * 2 - 1) * scale;
      scale *= rough; step = h;
    }
    const max = Math.max(...a.map(Math.abs));
    return a.map(v => v / max);
  }
  function ridgePath(y0, amp, rough, shape = () => 0) {
    const n = 128, a = mpd(n, rough);
    const pts = a.map((v, i) => { const x = i * W / n; return [x, y0 + v * amp + shape(x)]; });
    return { d: 'M0,' + BOTTOM + ' ' + pts.map(p => 'L' + f(p[0]) + ',' + f(p[1])).join(' ') + ' L' + W + ',' + BOTTOM + ' Z', pts };
  }
  const yAt = (pts, x) => { const i = Math.min(pts.length - 2, Math.floor(x / (W / (pts.length - 1)))); const t = (x - pts[i][0]) / (pts[i+1][0] - pts[i][0]); return lerp(pts[i][1], pts[i+1][1], t); };

  // Pine silhouette, tiered. Returns [darkPath, litPath(right side)]
  function pineVar(x, y, h) {
    const tiers = 2 + Math.floor(rng() * 3), w = h * (.28 + rng() * .14), lean = (rng() - .5) * .08;
    const side = sgn => {
      const pts = [];
      for (let k = 1; k <= tiers; k++) {
        const t = k / tiers, ty = -1 + t * .92 + (rng() - .5) * .04;
        const out = w * Math.pow(t, .8) * (.85 + rng() * .3);
        pts.push([sgn * out + lean * (1 + ty) * h, ty]);
        if (k < tiers) pts.push([sgn * out * (.42 + rng() * .15) + lean * (1 + ty) * h, ty + .02]);
      }
      return pts;
    };
    const top = [lean * 0, -1], Lp = side(-1), Rp = side(1);
    const P2 = ([px, py]) => f(x + px) + ',' + f(y + py * h);
    const trunk = [[-w * .08, -.06], [-w * .08, 0], [w * .08, 0], [w * .08, -.06]];
    const dark = 'M' + [top, ...Lp, trunk[0], trunk[1], trunk[2], trunk[3], ...Rp.slice().reverse()].map(P2).join('L') + 'Z';
    const lit = 'M' + [top, ...Rp, [w * .1, -.06], [lean * .5 * h, -.5]].map(P2).join('L') + 'Z';
    return [dark, lit];
  }
  function pine(x, y, h) {
    const w = h * 0.36;
    const L = [[0,-1],[-.22,-.72],[-.12,-.72],[-.36,-.42],[-.22,-.42],[-.5,-.06],[-.06,-.06],[-.06,0]];
    const pts = L.concat(L.slice().reverse().map(([px,py]) => [-px, py]));
    const dark = 'M' + pts.map(([px,py]) => f(x + px * w * 2) + ',' + f(y + py * h)).join('L') + 'Z';
    const R = [[0,-1],[.22,-.72],[.12,-.72],[.36,-.42],[.22,-.42],[.5,-.06],[.1,-.06]];
    const lit = 'M' + R.map(([px,py]) => f(x + px * w * 2) + ',' + f(y + py * h)).join('L') + 'L' + f(x) + ',' + f(y - h * .5) + 'Z';
    return [dark, lit];
  }

  const DEFS = `<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#05070f"/><stop offset=".45" stop-color="#0d1430"/><stop offset=".8" stop-color="#1f2b55"/><stop offset="1" stop-color="#2e3c6c"/>
    </linearGradient>
    <radialGradient id="sunGlow"><stop offset="0" stop-color="#fffbea" stop-opacity=".95"/><stop offset=".2" stop-color="#fff6d8" stop-opacity=".5"/><stop offset=".5" stop-color="#fff6d8" stop-opacity=".15"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></radialGradient>
    <radialGradient id="moonGlow"><stop offset="0" stop-color="#cfdcff" stop-opacity=".35"/><stop offset=".35" stop-color="#9fb6ff" stop-opacity=".10"/><stop offset="1" stop-color="#9fb6ff" stop-opacity="0"/></radialGradient>
    <linearGradient id="river" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#b8c8ef"/><stop offset=".35" stop-color="#6f86bd"/><stop offset="1" stop-color="#1d2b4f"/>
    </linearGradient>
    <linearGradient id="valley" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a2547"/><stop offset=".4" stop-color="#0c1328"/><stop offset="1" stop-color="#070b14"/></linearGradient>
    <filter id="blur" x="-50%" y="-300%" width="200%" height="700%"><feGaussianBlur stdDeviation="22"/></filter>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .06 0"/></filter>
  </defs>`;

  // Sky + stars
  const starG = ['', '', ''];   // one still group and two that twinkle as a whole
  for (let i = 0; i < 260; i++) {
    const x = rng() * W, y = Math.pow(rng(), 1.4) * 460, r = rng() < .06 ? 1.6 : .5 + rng() * .8;
    const o = (.35 + rng() * .65) * (1 - y / 560);
    starG[i % 3] += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#e8eeff" opacity="${o.toFixed(2)}"/>`;
    rng(); rng();   // keeps the random sequence, and so the rest of the scene, unchanged
  }
  layer(0.05, `<rect x="-200" y="-200" width="2000" height="1100" fill="url(#sky)"/>`);
  // Milky Way: a soft tilted band with a dense dusting of faint stars (static, night only)
  let milky = '';
  if (!DAY) {
    milky += `<g transform="rotate(-22 760 230)" filter="url(#blur)"><ellipse cx="760" cy="230" rx="980" ry="80" fill="#7f93d6" opacity=".10"/><ellipse cx="760" cy="226" rx="820" ry="30" fill="#b7c4f0" opacity=".08"/></g>`;
    let s2 = 99; const rng2 = () => { s2 = (s2 * 16807) % 2147483647; return (s2 - 1) / 2147483646; };
    const cos = Math.cos(-22 * Math.PI / 180), sin = Math.sin(-22 * Math.PI / 180);
    for (let i = 0; i < 520; i++) {
      const u = (rng2() - .5) * 1900, g = (rng2() + rng2() + rng2() - 1.5) * 70;
      const x = 760 + u * cos - g * sin, y = 230 + u * sin + g * cos;
      if (y > 430 || y < -20) continue;
      milky += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(.25 + rng2() * .45)}" fill="#e8eeff" opacity="${(.15 + rng2() * .45).toFixed(2)}"/>`;
    }
  }
  layer(0.05, milky);
  if (!DAY) {
    layer(0.05, starG[0]);
    layer(0.05, starG[1], { cls: 'tw', style: '--d:5.5s' });
    layer(0.05, starG[2], { cls: 'tw', style: '--d:7s;--dl:-3s' });
    layer(0.05, `<line x1="0" y1="0" x2="-70" y2="-26" stroke="#eef2ff" stroke-width="1.4" stroke-linecap="round"/><circle r="1.6" fill="#ffffff"/>`, { cls: 'meteor' });
  }
  // Stylized flat clouds, drifting slowly (day only)
  const cloud = (x, y, s, dur, delay) => {
    // Flat base, a few arcs of different sizes across the top
    const tops = [[-60,-14,22],[-28,-30,30],[10,-36,34],[46,-22,24],[70,-10,14]];
    const shape = (dy, k) => {
      let d = `M${-80 * s * k},${dy}`;
      for (const [cx, cy, r] of tops) d += `L${(cx - r * .9) * s * k},${(cy * .4 + dy / s) * s}A${r * s * k},${r * s * k} 0 0 1 ${(cx + r * .9) * s * k},${(cy * .4 + dy / s) * s}`;
      return d + `L${84 * s * k},${dy}Q${88 * s * k},${dy + 4 * s} ${80 * s * k},${dy + 6 * s}L${-76 * s * k},${dy + 6 * s}Q${-86 * s * k},${dy + 4 * s} ${-80 * s * k},${dy}Z`;
    };
    layer(0.07, `<g transform="translate(${x},${y})" opacity=".9"><path d="${shape(0, 1)}" fill="#dfeaf4"/><path d="${shape(-3 * s, .97)}" fill="#ffffff"/></g>`, { cls: 'cloud', style: `--dur:${dur}s;--dl:-${delay}s` });
  };
  if (DAY) { cloud(860, 120, 1, 170, 20); cloud(1420, 270, .85, 210, 90); cloud(1050, 300, .55, 240, 150); cloud(700, 70, .6, 200, 60); }
  // A small flock of birds crossing the far distance (day only)
  const bird = (x, y, s, beat, dl) => `<path transform="translate(${x},${y}) scale(${s})" fill="none" stroke="#2c3e52" stroke-width="1.3" stroke-linecap="round" d="M-6,-2 Q-3,-4 0,0 Q3,-4 6,-2">
    <animate attributeName="d" dur="${beat}s" begin="${dl}s" repeatCount="indefinite" values="M-6,-2 Q-3,-4 0,0 Q3,-4 6,-2;M-6,2.5 Q-3,0.5 0,0 Q3,0.5 6,2.5;M-6,-2 Q-3,-4 0,0 Q3,-4 6,-2"/></path>`;
  if (DAY) layer(0.1, bird(0, 0, 1.3, .55, 0) + bird(-26, 10, 1.1, .6, .2) + bird(-46, -7, 1.05, .5, .35) + bird(-70, 16, .9, .58, .1) + bird(20, 14, 1, .62, .3), { cls: 'flock', live: true });
  const haze = (speed, op, a, b) => { layer(speed, `<g filter="url(#blur)" opacity="${op}">${a}</g>`, { cls: 'mist' }); layer(speed, `<g filter="url(#blur)" opacity="${op}">${b}</g>`, { cls: 'mist b' }); };
  if (DAY) haze(0.08, .75, `<ellipse cx="300" cy="120" rx="220" ry="26" fill="#ffffff" opacity=".55"/><ellipse cx="1420" cy="300" rx="260" ry="20" fill="#ffffff" opacity=".4"/>`,
    `<ellipse cx="720" cy="210" rx="300" ry="22" fill="#ffffff" opacity=".45"/><ellipse cx="980" cy="90" rx="180" ry="16" fill="#ffffff" opacity=".35"/>`);

  // Moon
  layer(0.12, `<circle cx="1220" cy="170" r="240" fill="url(#moonGlow)"/>${DAY ? '<circle cx="1220" cy="170" r="380" fill="url(#sunGlow)"/>' : ''}<circle cx="1220" cy="170" r="44" fill="#f2f5ff"/>${DAY ? '' : '<circle cx="1206" cy="160" r="9" fill="#dfe6f8"/><circle cx="1232" cy="184" r="6" fill="#e4eaf9"/><circle cx="1228" cy="152" r="4" fill="#e1e8f8"/>'}`, { cls: 'orbit' });

  // Far ridges (atmospheric, lighter)
  const r1 = ridgePath(398, 48, .55, x => -34 * Math.sin(x / 520 + 1));
  const r2 = ridgePath(440, 34, .52, x => 16 * Math.cos(x / 380));
  layer(0.18, `<path d="${r1.d}" fill="#2b3866"/>`);
  layer(0.26, `<path d="${r2.d}" fill="#212c55"/>`);

  // Low-frequency noise for terrain tone variation
  const nz = (x, y) => (Math.sin(x / 140 + Math.cos(y / 90)) + Math.sin(y / 60 + x / 310) + Math.cos((x + y) / 210)) / 3;

  // River centreline: Catmull-Rom through hand-placed points (emerges from a notch, meanders, exits bottom right)
  const RP = [[905,474],[930,500],[880,540],[930,590],[1060,640],[1100,700],[1040,770],[1120,850],[1290,940],[1380,1060],[1420,1500]];
  function cr(t) {
    const n = RP.length - 1, i = Math.min(n - 1, Math.floor(t * n)), u = t * n - i;
    const p0 = RP[Math.max(0, i - 1)], p1 = RP[i], p2 = RP[i + 1], p3 = RP[Math.min(n, i + 2)];
    const c = k => .5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u * u * u);
    return [c(0), c(1)];
  }
  const riverPts = []; for (let i = 0; i <= 400; i++) riverPts.push(cr(i / 400));
  const V0 = 466, VH = BOTTOM - V0;
  const hwAt = y => 1.5 + 120 * Math.pow(Math.max(0, (y - V0) / 700), 1.5);
  const distToRiver = (x, y) => { let m = 1e9; for (let i = 0; i < riverPts.length; i += 2) { const dx = riverPts[i][0] - x, dy = (riverPts[i][1] - y) * 2.2; const d = dx * dx + dy * dy; if (d < m) m = d; } return Math.sqrt(m); };

  // Forested mid ridge with a notch where the river comes out
  const mid = ridgePath(470, 14, .6, x => -22 * Math.exp(-Math.pow((x - 905) / 70, 2)) * -1 + 10 * Math.sin(x / 300));
  let midTrees = '';
  for (let x = -20; x < W + 20; x += 3 + rng() * 4) { const y = yAt(mid.pts, Math.max(0, Math.min(W - 1, x))); const h = 8 + rng() * 9; if (Math.abs(x - 905) < 26) continue; midTrees += pine(x, y + 3, h)[0]; }
  layer(0.3, `<path d="${mid.d}" fill="#18214a"/><path d="${midTrees}" fill="#18214a"/>`);
  haze(0.3, .55, `<ellipse cx="450" cy="468" rx="540" ry="26" fill="#8a9dd0" opacity=".35"/>`, `<ellipse cx="1200" cy="476" rx="560" ry="24" fill="#8a9dd0" opacity=".3"/>`);

  // Valley terrain: rows drawn far to near. Each row is a hill profile; nearer rows hide what is behind them.
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const RZ = [[0,905],[.12,960],[.25,1010],[.38,880],[.5,840],[.62,990],[.75,1180],[.88,1360],[1,1480]];
  const riverX = z => {
    const n = RZ.length - 1; let i = 0; while (i < n - 1 && z > RZ[i + 1][0]) i++;
    const u = (z - RZ[i][0]) / (RZ[i + 1][0] - RZ[i][0]);
    const p0 = RZ[Math.max(0, i - 1)][1], p1 = RZ[i][1], p2 = RZ[i + 1][1], p3 = RZ[Math.min(n, i + 2)][1];
    return .5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
  };
  const yb = z => V0 + 700 * Math.pow(z, 1.5);           // flat-ground screen y at depth z
  const kz = z => 34 + 320 * Math.pow(z, 1.3);            // how tall a hill of height 1 looks at depth z
  const rw = z => 1.5 + 95 * Math.pow(z, 1.4);            // river half-width
  const H = (x, z) => {
    const X = (x - 820) / (.3 + .7 * z);
    const n = .55 * Math.sin(X / 170 + 1.7 * Math.sin(z * 5)) + .3 * Math.sin(X / 70 + z * 13 + 2) + .25 * Math.cos(X / 300 - z * 7);
    const hills = Math.pow(Math.max(0, n + .05), 1.3) * .75;
    const walls = Math.min(.55, Math.pow(Math.abs(X) / 1150, 2) * .75);
    const d = Math.abs(x - riverX(z)), w = rw(z);
    const corridor = smooth(w + 20 + 120 * z, w + 110 + 520 * z, d);   // flat valley floor along the river
    const bank = smooth(w + 2, w + 50 + 320 * z, d);  // gentle sloped banks
    return (hills * corridor + walls * corridor) * bank;
  };
  const meadow = (x, z) => Math.sin(x / 95 + z * 21) + Math.cos(x / 160 - z * 15) > .4;

  const ROWS = 110, X0 = -300, X1 = 1900, STEP = 10;
  let valley = `<rect x="-300" y="${V0}" width="2200" height="${BOTTOM}" fill="#26335f"/>`;
  let grads = '', fx = '';
  const glints = [], glintList = [], treeList = [];
  const riverSeg = r => {
    if (r < 0) return '';
    const z = Math.pow(r / ROWS, .85), z2 = Math.pow((r + 1) / ROWS, .85);
    const ax = riverX(z), bx = riverX(z2), aw = rw(z), bw = rw(z2), ay = yb(z) - .8, by = yb(z2) + .8;
    return `<path d="M${f(ax - aw)},${f(ay)}L${f(ax + aw)},${f(ay)}L${f(bx + bw)},${f(by)}L${f(bx - bw)},${f(by)}Z" fill="${mix('#b6c6ee', '#22325c', Math.pow(z, .6))}"/>`;
  };
  for (let r = 0; r < ROWS; r++) {
    const z = Math.pow(r / ROWS, .85), z2 = Math.pow((r + 1) / ROWS, .85);
    const base = Math.pow(z, .5);
    // Hill profile + a gradient that lightens slopes facing the moon (upper right)
    let d = `M${X0},${BOTTOM}`, stops = '';
    for (let x = X0; x <= X1; x += STEP) {
      const h = H(x, z), y = yb(z) - h * kz(z);
      d += `L${x},${f(y)}`;
      if ((x - X0) % 40 === 0) {
        const slope = (H(x + 8, z) - H(x - 8, z)) / 16 * kz(z);
        const light = Math.max(-.12, Math.min(.3, -slope * .9));
        const c = mix(mix('#2a3a68', '#080d19', base), '#4a5d94', Math.max(0, light));
        stops += `<stop offset="${((x - X0) / (X1 - X0)).toFixed(3)}" stop-color="${light < 0 ? mix(c, '#04070e', -light * 2) : c}"/>`;
      }
    }
    d += `L${X1},${BOTTOM}Z`;
    grads += `<linearGradient id="g${r}" gradientUnits="userSpaceOnUse" x1="${X0}" y1="0" x2="${X1}" y2="0">${stops}</linearGradient>`;
    valley += `<path d="${d}" fill="url(#g${r})"/>`;
    // River: segment two rows back, so nearby banks don't cut it up
    valley += riverSeg(r - 2);
    const ax = riverX(z), aw = rw(z), ay = yb(z);
    if (rng() < .6) { const gx = ax + (rng() - .5) * aw, gl = 1 + aw * .35 * rng(); glintList.push({ r, x1: gx - gl, x2: gx + gl, y: ay + 1, w: .5 + z }); }
    // Trees standing on this row
    const th = 5 + 105 * Math.pow(z, 1.35);
    const n = Math.min(200, Math.round(2200 / (th * .5)));
    let dk = '', lt = '';
    const nearTrees = [];
    const rowDark = mix('#1f2c55', '#04070e', base), rowLit = mix('#33467a', '#0f1830', base), rowEdge = mix('#0b1226', '#020409', base);
    for (let i = 0; i < n; i++) {
      const x = X0 + rng() * (X1 - X0), zz = lerp(z, z2, rng());
      const hgt = H(x, zz);
      if (Math.abs(x - riverX(zz)) < rw(zz) + th * .25 + 4) continue;
      if (hgt < .12 && meadow(x, zz)) continue;               // open meadows on the flats
      if (hgt < .03 && rng() < .5) continue;                  // sparser on the valley floor
      const y = yb(zz) - hgt * kz(zz) + 1.5, h = th * (.7 + rng() * .6);
      treeList.push([x, y, h, r]);
      if (h < 9) { const w = h * .36; dk += `M${f(x)},${f(y - h)}L${f(x + w)},${f(y)}L${f(x - w)},${f(y)}Z`; }
      else if (h < 16) { const [pd, pl] = pineVar(x, y, h); dk += pd; if (h > 12) lt += pl; }
      else nearTrees.push([x, y, h, rng()]);
    }
    if (dk) valley += `<path d="${dk}" fill="${rowDark}"/>`;
    if (lt) valley += `<path d="${lt}" fill="${rowLit}"/>`;
    // Larger trees: drawn one by one, back to front, each with its own outline and a slight color shift
    nearTrees.sort((a, b) => a[1] - b[1]);
    for (const [x, y, h, v] of nearTrees) {
      const [pd, pl] = pineVar(x, y, h);
      const fill = v < .33 ? mix(rowDark, '#04070e', .22) : v < .66 ? rowDark : mix(rowDark, '#3b4f6e', .16);
      const lit = v < .33 ? mix(rowLit, '#0f1830', .2) : v < .66 ? rowLit : mix(rowLit, '#4a6194', .22);
      valley += `<path d="${pd}" fill="${fill}" stroke="${rowEdge}" stroke-width="${f(.5 + h * .012)}" stroke-linejoin="round"/><path d="${pl}" fill="${lit}"/>`;
    }
  }
  valley += riverSeg(ROWS - 2) + riverSeg(ROWS - 1);
  // A glint is hidden if any nearer hill or tree covers it
  const covered = (x, y, r) => {
    for (let q = r + 1; q < ROWS; q++) { const zq = Math.pow(q / ROWS, .85); if (yb(zq) - H(x, zq) * kz(zq) < y && yb(zq) > y - 400) return true; }
    for (const [tx, ty, th, tr] of treeList) {
      if (tr < r + 2 || y > ty || y < ty - th) continue;
      if (Math.abs(x - tx) < th * .36 * (y - (ty - th)) / th) return true;
    }
    return false;
  };
  const glG = ['', '']; let gi = 0;   // river glints, twinkling as two groups
  for (const g of glintList) {
    if (covered(g.x1, g.y, g.r) || covered(g.x2, g.y, g.r) || covered((g.x1 + g.x2) / 2, g.y, g.r)) continue;
    glG[gi++ % 2] += `<line x1="${f(g.x1)}" y1="${f(g.y)}" x2="${f(g.x2)}" y2="${f(g.y)}" stroke="#e6edff" stroke-width="${f(g.w)}" opacity="${(.4 + rng() * .4).toFixed(2)}"/>`;
    rng();
  }
  valley = grads.length ? valley.replace('<rect', `<defs>${grads}</defs><rect`) : valley;
  layer(0.5, valley);
  layer(0.5, fx);
  layer(0.5, glG[0], { cls: 'tw', style: '--d:3s' });
  layer(0.5, glG[1], { cls: 'tw', style: '--d:3.7s;--dl:-1.5s' });
  haze(0.5, .35, `<ellipse cx="${f(riverX(.2))}" cy="${f(yb(.2))}" rx="320" ry="16" fill="#9fb2e0"/>`, `<ellipse cx="${f(riverX(.42))}" cy="${f(yb(.42))}" rx="380" ry="20" fill="#9fb2e0"/>`);

  // Foreground escarpment + wolf
  const rock = 'M-300,' + BOTTOM + ' L-300,740 L-40,736 L40,724 L120,752 L210,734 L300,766 L390,750 L470,770 L540,758 L580,744 L610,718 L740,708 L800,712 L835,728 L850,770 L866,806 L866,870 L930,935 L1010,985 L1120,1010 L1300,1000 L1500,960 L1700,930 L1900,930 L1900,' + BOTTOM + ' Z';
  const rockRim = 'M-40,736 L40,724 L120,752 L210,734 L300,766 L390,750 L470,770 L540,758 L580,744 L610,718 L740,708 L800,712 L835,728 L850,770 L866,806 L866,870 L930,935';
  // The wolf's rock: a lit top, a sunward right face and a shaded front, each broken into a few planes
  const fc = (pts, c) => `<path d="M${pts} Z" fill="${c}"/>`;
  const facets = [
    // top, with a broken front lip and the right-front corner cut away
    fc('580,744 610,718 680,713 660,760 600,772 586,775', '#131d33'), fc('680,713 740,708 800,712 770,752 660,760', '#111a2e'),
    fc('800,712 835,728 842,764 822,792 770,752', '#162138'), fc('586,775 600,772 660,760 690,808 655,814 592,806', '#0f172a'), fc('660,760 770,752 822,792 790,812 730,800 690,808', '#111a2e'),
    // front
    fc('592,806 655,814 648,872 620,900', '#0a101d'), fc('655,814 690,808 730,800 742,890 700,924 620,900 648,872', '#0d1425'),
    fc('730,800 790,812 796,880 742,890', '#0a101d'), fc('742,890 796,880 786,948 760,942 700,924', '#080d18'),
    // the angled plane between front and right, then the right side
    fc('790,812 822,792 848,826 842,892 820,960 786,948 796,880', '#0b111f'),
    fc('835,728 850,770 866,806 848,826 822,792 842,764', '#101829'), fc('866,806 880,870 842,892 848,826', '#0c1323'), fc('880,870 930,935 820,960 842,892', '#0a1120'),
    // moss low on the shaded side, cracks, and a lip that catches the light
    fc('600,842 618,834 632,856 628,886 616,893 606,868', '#111b30'), fc('606,868 616,893 628,886 624,870', '#0b1222'),
    `<path d="M690,808 L698,842 L688,872 L696,905 L700,924" fill="none" stroke="#080d18" stroke-width="1.6" stroke-linejoin="round"/>`,
    `<path d="M770,752 L778,778 L790,812" fill="none" stroke="#0f172a" stroke-width="1.4" stroke-linejoin="round"/>`,
    `<path d="M592,806 L655,814 L690,808 L730,800 L790,812 L822,792" fill="none" stroke="#5a6ea6" stroke-width="1.2" stroke-linejoin="round" opacity=".2"/>`
  ].join('');
  // Wolf from behind, body angled away, head turned right to look over the valley.
  // Points are in a ~800 x 980 drawing space, scaled into the scene.
  const P = pts => 'M' + pts.map(([x, y]) => x + ',' + y).join('L') + 'Z';
  const body = [
    [212,948],[200,926],[184,904],[180,890],[168,862],[166,840],[158,812],[160,782],[154,756],[164,728],[160,700],[172,672],[170,644],[184,610],[184,584],[198,552],[204,516],[220,480],[250,435],[275,418],            // tail, left edge, rump
    [305,385],[318,360],[312,350],[334,330],[330,318],[352,305],[380,288],[396,282],[412,268],[402,262],[418,250],[410,242],[426,232],[432,214],   // back, left mane
    [440,212],[446,170],[468,200],[490,196],[512,198],[538,166],[544,208],                  // ears, back of head
    [554,222],[566,228],[558,240],[572,252],[562,262],[574,280],[560,288],[566,304],[548,312], // right mane
    [540,380],[530,432],[518,470],[502,520],[496,600],[500,690],[532,718],[482,732],[470,700],[466,600],[455,545], // chest, near front leg
    [430,560],[412,600],[406,690],[416,706],[388,714],[384,650],[392,580],[405,540],            // far front leg
    [408,600],[396,680],[372,760],[368,805],[392,832],[376,848],[330,842],[322,805],[332,730],[328,660],[318,610],[300,570], // near hind leg
    [302,612],[299,624],[299,678],[294,692],[293,746],[288,758],[282,812],[275,826],[266,866],[254,884],[242,916],[226,934]   // tail, right edge, fur tufts
  ];
  const farHind = [[205,520],[240,500],[250,600],[236,700],[232,770],[250,792],[214,796],[206,760],[212,680]];
  const wolfFacets = [
    [[396,282],[412,268],[402,262],[418,250],[410,242],[426,232],[432,214],[440,212],[452,204],[468,200],[490,240],[530,270],[548,312],[540,380],[480,360],[420,320],[380,288]], '#22345e',
    [[468,200],[490,196],[512,198],[538,166],[544,208],[540,232],[530,270],[490,240]], '#2e4274',
    [[544,208],[554,222],[566,228],[558,240],[572,252],[562,262],[574,280],[560,288],[566,304],[548,312],[530,270],[540,232]], '#2b3e6e',
    [[426,232],[432,214],[440,212],[452,204],[468,200],[490,240],[462,236],[440,246]], '#1b2a4e',
    [[446,170],[468,200],[452,204]], '#1c2b50',
    [[538,166],[544,208],[530,200]], '#6d83c0',
    [[305,385],[318,360],[352,305],[380,288],[410,262],[420,320],[480,360],[540,380],[530,432],[460,470],[395,405]], '#172441',
    [[250,435],[275,418],[305,385],[395,405],[350,420],[290,432]], '#2c3e6c',
    [[250,435],[290,432],[350,420],[395,405],[405,540],[408,600],[396,680],[372,760],[330,650],[300,570],[220,480]], '#121c34',
    [[540,380],[530,432],[518,470],[502,520],[496,600],[470,520]], '#1d2d54',
    [[220,480],[250,435],[300,570],[302,612],[299,624],[299,678],[294,692],[293,746],[288,758],[282,812],[275,826],[266,866],[254,884],[242,916],[226,934],[212,948],[222,880],[232,800],[240,640]], '#1a2747',
    [[244,610],[266,650],[256,724],[244,790],[236,712]], '#1f2d52',
    [[200,760],[214,800],[210,860],[198,830]], '#141f3a'
  ];
  let facetSvg = '';
  for (let i = 0; i < wolfFacets.length; i += 2) facetSvg += `<path d="${P(wolfFacets[i])}" fill="${wolfFacets[i + 1]}"/>`;
  const rim = 'M440,212 L446,170 L468,200 L490,196 L512,198 L538,166 L544,208 L554,222 L566,228 L558,240 L572,252 L562,262 L574,280 L560,288 L566,304 L548,312';
  const maneRim = 'M380,288 L396,282 L412,268 L402,262 L418,250 L410,242 L426,232 L432,214 L440,212';
  const rumpRim = 'M192,560 L220,480 L250,435 L275,418 L305,385 L318,360';
  const sideRim = 'M548,312 L540,380 L530,432 L518,470 L502,520 L496,600 L500,690';
  const wolf = `<g transform="translate(545,440) scale(.4)">
    <path d="${P(farHind)}" fill="#060a13"/>
    <path d="${P(body)}" fill="#0a101e"/>
    ${facetSvg}
    <path d="${rim}" fill="none" stroke="#c9d6fa" stroke-width="3.5" stroke-linejoin="round" opacity=".9"/>
    <path d="${maneRim}" fill="none" stroke="#93a7dc" stroke-width="2.5" stroke-linejoin="round" opacity=".6"/>
    <path d="${rumpRim}" fill="none" stroke="#93a7dc" stroke-width="2.5" stroke-linejoin="round" opacity=".55"/>
    <path d="M300,570 L302,612 L299,624 L299,678 L294,692 L293,746 L288,758 L282,812 L275,826 L266,866 L254,884 L242,916 L226,934 L212,948" fill="none" stroke="#93a7dc" stroke-width="2.5" stroke-linejoin="round" opacity=".55"/>
    <path d="${sideRim}" fill="none" stroke="#93a7dc" stroke-width="2.5" stroke-linejoin="round" opacity=".5"/>
  </g>`;
  // --- Ground: the cliff top is a meadow running toward the viewer, with a worn path up to the wolf's rock ---
  const TOP = [[-300,740],[-40,736],[40,724],[120,752],[210,734],[300,766],[390,750],[470,770],[540,758],[580,744],[610,718],[740,708],[800,712],[835,728],[850,770],[866,806],[866,870],[930,935],[1010,985],[1120,1010],[1300,1000],[1500,960],[1700,930],[1900,930]];
  const at = (K, v) => { for (let i = 0; i < K.length - 1; i++) if (v <= K[i + 1][0]) { const t = Math.max(0, (v - K[i][0]) / ((K[i + 1][0] - K[i][0]) || 1)); return K[i].map((a, j) => a + (K[i + 1][j] - a) * t); } return K[K.length - 1]; };
  const topY = x => at(TOP, x)[1];
  const FL = flora(rng);
  // tones are authored in night colors and mapped for day by the palette
  const C = { g1: '#101a30', g2: '#1c2c4a', sh: '#0b1220', b0: '#0b1222', b1: '#111b30', b2: '#18243f', b3: '#22325a', b4: '#2a3d6c', s0: '#1b2338', s1: '#121829', s2: '#283250' };
  const poly = pts => 'M' + pts.map(p => f(p[0]) + ',' + f(p[1])).join('L') + 'Z';
  const fill = (d, c) => `<path d="${d}" fill="${c}"/>`;
  const dot = (x, y, r) => `M${f(x - r)},${f(y)}a${f(r)},${f(r * .6)} 0 1 0 ${f(r * 2)},0a${f(r)},${f(r * .6)} 0 1 0 ${f(-r * 2)},0Z`;
  const sc = y => .6 + Math.pow(Math.max(0, y - 720) / 300, 1.1);   // things get bigger toward the viewer
  // the path: [y, centre x, half width]. It ends wide and centred so the sheet's path can take over.
  const PATH = [[752,596,7],[790,578,10],[840,574,14],[890,590,20],[930,625,27],[965,668,36],[1000,712,48],[1040,756,70],[1080,786,108],[1120,800,156],[1160,802,192],[1200,800,216],[1260,800,244],[1500,800,320]];
  const pathPoly = (grow, pad, jit) => { const L = [], R = []; for (let y = 752; y <= BOTTOM; y += 17) { const [, cx, hw] = at(PATH, y), w = hw * grow + pad; L.push([cx - w + (rng() - .5) * jit, y]); R.push([cx + w + (rng() - .5) * jit, y]); } return poly(L.concat(R.reverse())); };
  const onPath = (x, y, pad = 0) => { const [, cx, hw] = at(PATH, y); return y > 745 && Math.abs(x - cx) < hw * 1.22 + 10 + pad; };
  const onApron = (x, y) => x > 540 && x < 950 && y > 700 && y < 1010;
  // bare earth along the cliff's lip, then turf in bands that darken toward the viewer
  const lip = x => 11 + Math.max(0, topY(x) - 720) * .07 + 5 * Math.sin(x / 47) + 3 * Math.sin(x / 19 + 2);
  const turfTop = x => topY(x) + lip(x);
  const yA = x => Math.max(1040 + 22 * Math.sin(x / 210 + 1) + 10 * Math.sin(x / 83), turfTop(x) + 46);
  const yB = x => 1215 + 26 * Math.sin(x / 260 + 2) + 12 * Math.sin(x / 97);
  const edge = (yf, step, teeth) => { const pts = []; for (let x = -300; x < 1900; x += step * (.6 + rng() * .8)) { const y = yf(x); pts.push([x, y + (rng() - .5) * 3]); if (teeth) pts.push([x + step * .3, y - teeth * (.5 + rng())]); } pts.push([1900, yf(1900)], [1900, BOTTOM], [-300, BOTTOM]); return poly(pts); };
  let ground = fill(rock, '#0c0f18') + fill(edge(turfTop, 16, 0), '#14203a') + fill(edge(yA, 9, 6), '#111c33') + fill(edge(yB, 11, 10), '#0f182c');
  // broad sunlit facets so the turf reads as ground with some form, like the rock
  { let lit = ''; for (let i = 0; i < 30; i++) { const x = -200 + rng() * 2000, y = 820 + rng() * 640, k = sc(y), w = (50 + rng() * 60) * k, h = (10 + rng() * 12) * k;
      if (y - h < Math.max(turfTop(x - w), turfTop(x), turfTop(x + w)) + 8) continue;
      lit += poly([[x - w, y], [x - w * .2, y - h], [x + w, y - h * .3], [x + w * .3, y + h * .6]]); }
    ground += fill(lit, '#172543'); }
  // earth around the rock, and the path with its shoulders
  ground += fill(poly([[548,764],[562,820],[560,872],[584,922],[640,958],[705,988],[775,1004],[845,1004],[905,988],[938,962],[922,948],[884,906],[860,880],[700,800],[600,770]]), '#0c0f18');
  ground += fill(poly([[570,880],[600,930],[668,965],[640,930],[600,890]]) + poly([[800,985],[870,996],[915,972],[880,962]]), '#090c13');
  ground += `<defs><linearGradient id="pathG" gradientUnits="userSpaceOnUse" x1="0" y1="770" x2="0" y2="1300"><stop offset="0" stop-color="#131829"/><stop offset=".55" stop-color="#1a2136"/><stop offset="1" stop-color="#1e263c"/></linearGradient>
    <linearGradient id="shoulderG" gradientUnits="userSpaceOnUse" x1="0" y1="770" x2="0" y2="1300"><stop offset="0" stop-color="#0e121c"/><stop offset=".55" stop-color="#151b2c"/><stop offset="1" stop-color="#191f31"/></linearGradient></defs>`;
  ground += fill(pathPoly(1.1, 6, 4), 'url(#shoulderG)') + fill(pathPoly(1, 0, 3), 'url(#pathG)');
  let pebD = '', pebL = '';
  for (let i = 0; i < 46; i++) { const y = 800 + Math.pow(rng(), .8) * 660, [, cx, hw] = at(PATH, y), d = dot(cx + (rng() * 2 - 1) * hw * .9, y, (.8 + rng() * 1.8) * sc(y) * .55); if (rng() < .6) pebD += d; else pebL += d; }
  for (let i = 0; i < 26; i++) { const d = dot(596 + rng() * 310, 925 + rng() * 68, 1 + rng() * 2.2); if (rng() < .5) pebD += d; else pebL += d; }
  for (let i = 0; i < 60; i++) { const x = -100 + rng() * 1800; if (x > 575 && x < 872) continue; const d = dot(x, topY(x) + 3 + rng() * (lip(x) - 5), .8 + rng() * 1.4); if (rng() < .5) pebD += d; else pebL += d; }
  ground += fill(pebD, '#121727') + fill(pebL, '#283250');

  // plants and stones, each drawn whole and sorted so nearer ones overlap farther ones
  const items = [], put = (y, svg) => items.push([y, svg]);
  const bushes = [[150,800,24],[335,840,28],[455,902,32],[55,932,44],[250,1012,50],[478,1064,46],[-90,1050,60],[606,1014,34],[952,1066,34],[1046,1094,38],[1236,1078,44],[1424,1042,48],[1606,1012,52],[1184,1186,56],[1385,1172,60],[380,1200,58],[110,1190,64]];
  for (const [x, y, r] of bushes) { put(y, FL.bush(x, y, r, C)); for (const k of [-1.25, 1.3]) put(y + 2, FL.clump(x + k * r, y + 2, r / 30, C)); }
  const stones = [[546,900,12],[686,930,9],[836,972,11],[742,974,15],[872,986,21],[905,1004,12],[1032,1132,22],[598,1088,20],[520,792,7],[300,786,6],[1180,1034,9]];
  for (const [x, y, r] of stones) { put(y, FL.stone(x, y, r, C)); put(y + 1, FL.clump(x - r * 1.2, y + 1, r / 16, C)); }
  for (const [x, y, k] of [[650,914,.8],[735,940,.7],[792,954,.95],[900,952,.8]]) put(y, FL.clump(x, y, k, C));
  for (let y = 962, side = 1; y < 1480; y += 26 * sc(y) * (.7 + rng() * .6), side = -side) { const [, cx, hw] = at(PATH, y); put(y, FL.clump(cx + side * (hw * 1.22 + 12 + rng() * 14 * sc(y)), y, sc(y) * (.7 + rng() * .4), C)); }
  for (const yf of [yA, yB]) for (let x = -80 + rng() * 60; x < 1700; x += 70 + rng() * 80) { const y = yf(x) + 3; if (!onPath(x, y, 24) && !onApron(x, y)) put(y, FL.clump(x, y, sc(y) * .8, C)); }
  // small sprigs spaced evenly through the turf for texture
  let sprA = '', sprB = '';
  for (let gy = 800; gy < 1480; gy += 46 * sc(gy)) for (let gx = -80 + rng() * 60; gx < 1700; gx += 76 * sc(gy)) {
    if (rng() < .4) continue;
    const x = gx + (rng() - .5) * 40 * sc(gy), y = gy + (rng() - .5) * 20 * sc(gy);
    if (y < turfTop(x) + 14 || onPath(x, y, 20) || onApron(x, y)) continue;
    const [a, b] = FL.clumpD(x, y, sc(y) * .42); sprA += a; sprB += b;
  }
  // Framing pines: a trunk rooted in the ground and tiers of drooping boughs, lit from the sun side
  const bigPine = (x, y, h) => {
    const n = Math.round(6 + h / 110), w = h * .3, tw = h * .026, span = h * .86, y0 = y - h;
    let s = fill(poly([[x - tw * 2.2, y + 3], [x - tw * 1.1, y - h * .05], [x - tw * .7, y - h * .5], [x + tw * .7, y - h * .5], [x + tw * 1.1, y - h * .05], [x + tw * 2.4, y + 3], [x + tw * .5, y + 1], [x, y + 4]]), '#0a0d14');
    s += fill(poly([[x + tw * .2, y - h * .5], [x + tw * .7, y - h * .5], [x + tw * 1.1, y - h * .05], [x + tw * 2.4, y + 3], [x + tw * .5, y + 1], [x + tw * .3, y - h * .05]]), '#10141d');
    for (let k = n - 1; k >= 0; k--) {
      const yT = y0 + span * k / n - (k ? span / n * .55 : 0), yB = y0 + span * (k + 1) / n, wk = w * Math.pow((k + 1) / n, .8) * (.92 + rng() * .16), wt = wk * .08, drop = span / n * .24;
      const m = 3 + Math.round(wk / 24), B = [];
      for (let j = 0; j <= 2 * m; j++) B.push([x + wk - 2 * wk * j / (2 * m) + (rng() - .5) * wk / m * .3, j % 2 ? yB - drop * (.7 + rng() * .5) : yB + drop * (.3 + rng() * .9) - (j === 0 || j === 2 * m ? drop * .5 : 0)]);
      const L = q => q.map(v => 'L' + f(v[0]) + ',' + f(v[1])).join(''), mid = yT + (yB - yT) * .6;
      s += fill(`M${f(x - wt)},${f(yT)}L${f(x + wt)},${f(yT)}Q${f(x + wk * .42)},${f(mid)} ${f(B[0][0])},${f(B[0][1])}${L(B.slice(1))}Q${f(x - wk * .42)},${f(mid)} ${f(x - wt)},${f(yT)}Z`, '#070c18');
      const c = Math.round(m * .75), e = Math.round(m * 1.35);
      s += fill(`M${f(x + wt)},${f(yT)}Q${f(x + wk * .42)},${f(mid)} ${f(B[0][0])},${f(B[0][1])}${L(B.slice(1, c + 1))}L${f(x + wk * .16)},${f(yT + (yB - yT) * .42)}Z`, '#0c1626');
      s += fill(`M${f(x - wt)},${f(yT)}Q${f(x - wk * .42)},${f(mid)} ${f(B[2 * m][0])},${f(B[2 * m][1])}${L(B.slice(e, 2 * m).reverse())}L${f(x - wk * .1)},${f(yT + (yB - yT) * .5)}Z`, '#04070d');
    }
    return s + FL.clump(x - tw * 3.4, y + 4, h / 260, C) + FL.clump(x + tw * 3.8, y + 5, h / 300, C);
  };
  const fgPines = [[-24, 774, 470], [100, 784, 380], [1560, 992, 520], [1456, 1002, 380]].map(t => bigPine(...t)).join('');
  items.sort((a, b) => a[0] - b[0]);
  const draw = test => items.filter(i => test(i[0])).map(i => i[1]).join('');
  layer(1.15, `${ground}${facets}<path d="${rockRim}" fill="none" stroke="#5a6ea6" stroke-width="1.2" opacity=".55"/>${fill(sprA, '#101a30')}${fill(sprB, '#1c2c4a')}${draw(y => y <= 830)}${fgPines}${wolf}${draw(y => y > 830)}`);

  // --- A nearer rise on each side, leaving an opening the path runs through ---
  {
    const ML = [[-300,1000],[0,1035],[250,1085],[440,1150],[570,1250],[640,1400],[660,1500]], MR = [[950,1500],[965,1400],[1030,1240],[1160,1140],[1360,1080],[1620,1020],[1900,985]];
    const mid = [], mound = (K, x0, x1, dy) => { const pts = []; for (let x = x0; x <= x1; x += 18) pts.push([x, at(K, x)[1] + dy + (dy ? 16 * Math.sin(x / 90) : (rng() - .5) * 5)]); return poly([[x0, BOTTOM], ...pts, [x1, BOTTOM]]); };
    let s = fill(mound(ML, -300, 660, 0) + mound(MR, 950, 1900, 0), '#0c1424') + fill(mound(ML, -300, 560, 80) + mound(MR, 1050, 1900, 80), '#0a111f');
    for (const [x, r] of [[-150,86],[62,70],[268,60],[418,48],[1752,90],[1528,72],[1312,60],[1136,48]]) { const y = at(x < 800 ? ML : MR, x)[1] + r * .5; mid.push([y, FL.bush(x, y, r, C)]); for (const k of [-1.25, 1.3]) mid.push([y + 2, FL.clump(x + k * r, y + 2, r / 30, C)]); }
    for (let x = -280; x < 1900; x += 60 + rng() * 70) { if (x > 540 && x < 1070) continue; const y = at(x < 800 ? ML : MR, x)[1] + 5; mid.push([y, FL.clump(x, y, 1.9 + rng() * .7, C)]); }
    for (const [x, y, r] of [[588,1300,34],[1012,1290,30],[520,1236,16]]) mid.push([y, FL.stone(x, y, r, C)]);
    mid.sort((a, b) => a[0] - b[0]);
    layer(1.3, s + mid.map(i => i[1]).join(''));
  }

  // --- Nearest foliage in the bottom corners, rising fastest, so we seem to walk toward the edge ---
  {
    const near = [], N = { ...C, sh: '' };
    const corner = (x0, x1) => {
      for (let i = 0; i < 4; i++) { const x = x0 + (i + .2 + rng() * .6) / 4 * (x1 - x0), y = 1090 + rng() * 200; near.push([y, FL.bush(x, y, 88 + rng() * 40, N)]); }
      for (let i = 0; i < 12; i++) { const y = 1130 + rng() * 220; near.push([y, FL.clump(x0 - 40 + rng() * (x1 - x0 + 80), y, 3 + rng() * 1.2, N)]); }
    };
    corner(-320, 300); corner(1300, 1920);
    near.sort((a, b) => a[0] - b[0]);
    layer(1.45, near.map(i => i[1]).join(''));
  }

  // One element per part, grouped into a moving layer per speed. Static parts and sprites become canvases, drawn once in bake().
  const tag = DAY ? 'd-' : 'n-';
  const scoped = str => str.replace(/id="/g, `id="${tag}`).replace(/url\(#/g, `url(#${tag}`);
  const defs = scoped(recolor(DEFS)), layers = [], parts = [];
  for (const L of LAYERS) {
    let grp = layers[layers.length - 1];
    if (!grp || grp.s !== L.speed) { const el = document.createElement('div'); el.className = 'layer'; host.appendChild(el); layers.push(grp = { el, s: L.speed }); }
    const body = scoped(recolor(L.content));
    const el = L.live ? document.createElementNS('http://www.w3.org/2000/svg', 'svg') : document.createElement('canvas');
    if (L.live) el.innerHTML = body;
    if (L.cls) el.setAttribute('class', L.cls);
    if (L.style) el.style.cssText = L.style;
    grp.el.appendChild(el);
    parts.push({ el, body, s: L.speed, sprite: !!L.cls, live: !!L.live, defs: body.includes('url(#') ? defs : '' });
  }
  return { host, layers, parts, orbit: host.querySelector('.orbit') };
  }

  // Frame wolf + river on narrow screens; work out which part of the scene is on screen (V) and how many px one scene unit is
  const scenes = {};
  let unit = 1, V = { x0: 0, y0: 0, rw: W, rh: 900 };
  function frame() {
    const w = scene.clientWidth, h = scene.clientHeight, vw = 900 * w / h;
    if (vw < W) { const cx = Math.max(vw / 2, Math.min(W - vw / 2, 770)); unit = h / 900; V = { x0: cx - vw / 2, y0: 0, rw: vw, rh: 900 }; }
    else { unit = Math.max(w / W, h / 900); V = { x0: W / 2 - w / unit / 2, y0: 450 - h / unit / 2, rw: w / unit, rh: h / unit }; }
    scene.style.setProperty('--u', unit + 'px');
  }
  // Draw one part into its canvas. Static parts only cover what can ever scroll into view; sprites cover their own extent.
  const meas = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  meas.setAttribute('style', 'position:absolute;left:-9999px;top:0;width:10px;height:10px;visibility:hidden');
  const extent = p => { if (!p.box) { meas.innerHTML = `<g>${p.body}</g>`; document.body.appendChild(meas); const b = meas.firstChild.getBBox(); p.box = [b.x, b.y, b.x + b.width, b.y + b.height]; meas.innerHTML = ''; meas.remove(); } return p.box; };
  async function bake(p) {
    const soft = p.body.includes('filter='), pad = soft ? 80 : 4;
    let [x, y, x2, y2] = extent(p); x -= pad; y -= pad; x2 += pad; y2 += pad;
    if (!p.sprite) { x = Math.max(x, V.x0); x2 = Math.min(x2, V.x0 + V.rw); y = Math.max(y, V.y0); y2 = Math.min(y2, V.y0 + V.rh + p.s * RANGE + 2); }
    const w = x2 - x, h = y2 - y, st = p.el.style;
    if (w <= 0 || h <= 0) { st.display = 'none'; return; }
    st.display = ''; st.left = (x - V.x0) * unit + 'px'; st.top = (y - V.y0) * unit + 'px'; st.width = w * unit + 'px'; st.height = h * unit + 'px';
    if (p.live) { p.el.setAttribute('viewBox', `${x} ${y} ${w} ${h}`); return; }
    // retina-sharp up to 2x; blurred sprites need only half that; cap very large canvases
    const k = Math.min(unit * Math.min(devicePixelRatio || 1, 2) * (soft && p.sprite ? .5 : 1), Math.sqrt(12e6 / (w * h)));
    const pw = Math.max(1, Math.round(w * k)), ph = Math.max(1, Math.round(h * k)), job = p.job = (p.job || 0) + 1;
    const url = URL.createObjectURL(new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}" viewBox="${x} ${y} ${w} ${h}" preserveAspectRatio="none">${p.defs}${p.body}</svg>`], { type: 'image/svg+xml' }));
    const img = new Image();
    try { await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; }); } finally { URL.revokeObjectURL(url); }
    if (p.job !== job) return;
    p.el.width = pw; p.el.height = ph; p.el.getContext('2d').drawImage(img, 0, 0, pw, ph);
  }
  const bakeScene = sc => sc.ready = Promise.all(sc.parts.map(bake)).catch(e => console.error('scene bake failed', e)).then(() => sc.host.classList.add('ready'));
  // Scroll-driven parallax
  const copy = document.getElementById('copy'), hint = document.getElementById('hint'), hero = document.querySelector('.hero');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const RANGE = 420; // viewBox units of travel for speed 1.0
  let ticking = false;
  function update() {
    ticking = false;
    const max = hero.offsetHeight - innerHeight;
    const p = Math.min(1, Math.max(0, scrollY / max));
    for (const sc of Object.values(scenes)) for (const { el, s } of sc.layers) el.style.transform = `translate3d(0, ${(-p * s * RANGE * unit).toFixed(1)}px, 0)`;
    copy.style.transform = `translateY(${-p * 120}px)`;
    copy.style.opacity = Math.max(0, 1 - p * 1.8);
    hint.style.opacity = Math.max(0, 1 - p * 5);
  }
  // Redraw the canvases when the scene's size really changes (not on every mobile toolbar show/hide)
  let baked = '', rz;
  new ResizeObserver(() => {
    const size = scene.clientWidth + 'x' + scene.clientHeight;
    if (size === baked) return;
    baked = size; frame(); update();
    clearTimeout(rz); rz = setTimeout(() => Object.values(scenes).forEach(bakeScene), 180);
  }).observe(scene);
  if (!reduce) {
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  }

  // Day / night: build each scene on first use, crossfade between them
  const forced = new URLSearchParams(location.search).get('time');
  const hour = new Date().getHours();
  let isDay = document.documentElement.dataset.time === 'day';
  const toggle = document.getElementById('toggle');
  let current = null, busy = false;
  const ensure = key => { if (!scenes[key]) { scenes[key] = buildScene(key === 'day'); scene.appendChild(scenes[key].host); frame(); baked = scene.clientWidth + 'x' + scene.clientHeight; bakeScene(scenes[key]); update(); } return scenes[key]; };
  // Swapping themes: the outgoing scene sits on top and fades out over the incoming one. Page colours switch at once.
  function show(key, fade) {
    document.documentElement.dataset.time = key;
    for (const k in scenes) {
      const h = scenes[k].host, was = h.classList.contains('on');
      h.classList.toggle('on', k === key);
      if (was && k !== key && fade) { h.classList.add('out'); setTimeout(() => h.classList.remove('out'), 1200); }
    }
  }
  function setTheme(day, animate) {
    const key = day ? 'day' : 'night', prev = current;
    if (key === prev || busy) return;
    isDay = day; current = key;
    const inn = ensure(key), out = prev && scenes[prev];
    toggle.setAttribute('aria-label', day ? 'Switch to night' : 'Switch to day');
    if (animate) saveTheme(key);
    if (!animate || !out || reduce) { show(key); return; }
    // The current sun/moon sinks below the ridges, the sky crossfades, then the other rises
    busy = true;
    inn.ready.then(() => {
      inn.orbit.classList.add('instant', 'below'); inn.orbit.getBoundingClientRect(); inn.orbit.classList.remove('instant');
      out.orbit.classList.add('below');
      setTimeout(() => show(key, true), 550);
      setTimeout(() => inn.orbit.classList.remove('below'), 1100);
      setTimeout(() => { out.orbit.classList.remove('below'); busy = false; }, 2300);
    });
  }
  setThemeHandler(next => setTheme(next === 'day', true));
  // The sun or moon is a bitmap now, so test clicks against its disc
  const onOrb = e => { const o = scenes[current] && scenes[current].orbit; if (!o) return false; const r = o.getBoundingClientRect(); return Math.hypot(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2) < 70 * unit; };
  scene.addEventListener('click', e => { if (onOrb(e)) setTheme(!isDay, true); });
  scene.addEventListener('mousemove', e => { scene.style.cursor = onOrb(e) ? 'pointer' : ''; });
  // Film grain: one shared bitmap over both scenes
  { const g = document.createElement('canvas'); g.className = 'grain'; g.width = Math.min(scene.clientWidth, 1920); g.height = Math.min(scene.clientHeight, 1200); scene.appendChild(g);
    const img = new Image(); img.onload = () => g.getContext('2d').drawImage(img, 0, 0);
    img.src = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .06 0"/></filter><rect width="100%" height="100%" filter="url(#g)" opacity=".9"/></svg>`); }
  setTheme(isDay, false);
  // Build the other scene while the browser is idle so the first switch is instant
  (window.requestIdleCallback || (fn => setTimeout(fn, 1200)))(() => ensure(isDay ? 'night' : 'day'));
}
