import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AstroPreview } from './astro-preview.ts';

// A stand-in for astro: fails while the file `broken` exists (like a post with bad front
// matter), otherwise serves on the port it's given.
const FAKE_ASTRO = `
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
if (existsSync(join(process.cwd(), 'broken'))) {
  console.error('InvalidContentEntryDataError: title Required');
  process.exit(1);
}
const port = Number(process.argv[process.argv.indexOf('--port') + 1]);
createServer((_, res) => res.end('ok')).listen(port, '127.0.0.1');
`;

let preview: AstroPreview | undefined;
afterEach(() => preview?.stop());

describe('AstroPreview', () => {
  it('says why astro stopped, and starts it again when asked after the problem is fixed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'astro-preview-'));
    await mkdir(join(root, 'node_modules/astro/bin'), { recursive: true });
    await writeFile(join(root, 'node_modules/astro/bin/astro.mjs'), FAKE_ASTRO);
    await writeFile(join(root, 'broken'), '');

    preview = new AstroPreview(root, 4455);
    await expect(preview.origin()).rejects.toThrow(/title Required/);

    await rm(join(root, 'broken'));
    await expect(preview.origin()).resolves.toBe('http://127.0.0.1:4455');
  });
});
