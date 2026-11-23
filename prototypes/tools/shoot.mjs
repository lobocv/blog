// Screenshots of one page at several scroll positions, through the DevTools protocol.
// Usage: node prototypes/tools/shoot.mjs URL OUT_DIR WIDTHxHEIGHT [SPEC ...]
// SPEC is `name=js expression` evaluated before the shot, eg `radar=scrollTo(0, 2400)`.
// Reports page exceptions, so a script error shows up next to the images.
import { spawn } from 'node:child_process'; import fs from 'node:fs';
const [,, url, outDir, size = '1280x900', ...specs] = process.argv;
const [w, h] = size.split('x').map(Number);
fs.mkdirSync(outDir, { recursive: true });
const chrome = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--window-size=${w},${h}`, '--hide-scrollbars', '--user-data-dir=' + outDir + '/.profile', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let target; for (let i = 0; i < 40 && !target; i++) { await sleep(250); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = e => { const m = JSON.parse(e.data);
  if (m.id) pending.get(m.id)?.(m.result);
  else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text); };
const send = (method, params = {}) => new Promise(r => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
await send('Page.navigate', { url }); await sleep(2500);
for (const spec of specs.length ? specs : ['top=0']) {
  const [name, ...rest] = spec.split('='); const expr = rest.join('=');
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  await sleep(1500);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${outDir}/${name}.png`, Buffer.from(shot.data, 'base64'));
  console.log(name, r?.result?.value !== undefined ? JSON.stringify(r.result.value) : '');
}
console.log('errors', errors.length, errors.slice(0, 3));
ws.close(); proc.kill(); process.exit(0);
