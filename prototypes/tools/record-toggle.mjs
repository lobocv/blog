// Records the day/night toggle through the DevTools protocol and saves every frame.
import { spawn } from 'node:child_process'; import fs from 'node:fs';
const [,, url, outDir, dpr = '2'] = process.argv;
fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true });
const chrome = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=9333', '--window-size=1440,900', `--force-device-scale-factor=${dpr}`, '--hide-scrollbars', '--user-data-dir=' + outDir + '/profile', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let target; for (let i = 0; i < 40 && !target; i++) { await sleep(250); try { target = (await (await fetch('http://127.0.0.1:9333/json')).json()).find(t => t.type === 'page'); } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(); const frames = []; const logs = [];
ws.onmessage = e => { const m = JSON.parse(e.data);
  if (m.id) pending.get(m.id)?.(m.result);
  else if (m.method === 'Page.screencastFrame') { frames.push({ t: m.params.metadata.timestamp, data: m.params.data }); send('Page.screencastFrameAck', { sessionId: m.params.sessionId }); }
  else if (m.method === 'Runtime.exceptionThrown') logs.push(m.params.exceptionDetails.text); };
const send = (method, params = {}) => new Promise(r => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url }); await sleep(6000);
await send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 1 }); await sleep(400);
const t0 = Date.now() / 1000;
await send('Runtime.evaluate', { expression: "document.getElementById('toggle').click()" });
await sleep(4200); await send('Page.stopScreencast');
frames.forEach((f, i) => fs.writeFileSync(`${outDir}/f${String(i).padStart(3, '0')}.jpg`, Buffer.from(f.data, 'base64')));
fs.writeFileSync(outDir + '/times.json', JSON.stringify(frames.map(f => +(f.t - t0).toFixed(3))));
console.log('frames', frames.length, 'errors', logs.length, logs.slice(0, 3));
ws.close(); proc.kill(); process.exit(0);
