// Fails when any path the Hugo site served (tests/old-urls.txt) has no file in dist/.
import fs from 'node:fs';
import path from 'node:path';
import { oldUrlMissing } from '../src/lib/urls.ts';

const files = new Set(fs.readdirSync('dist', { recursive: true }).map(f => f.split(path.sep).join('/')));
const paths = fs.readFileSync('tests/old-urls.txt', 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
const missing = paths.filter(p => oldUrlMissing(p, files));
if (missing.length) { console.error(`Missing ${missing.length} of ${paths.length} old URLs:\n  ${missing.join('\n  ')}`); process.exit(1); }
console.log(`All ${paths.length} old URLs exist in dist/`);

// GitHub Pages serves 404.html at every missing path, so it must not claim a canonical URL.
if (/rel="canonical"/.test(fs.readFileSync('dist/404.html', 'utf8'))) { console.error('dist/404.html has a canonical link'); process.exit(1); }
