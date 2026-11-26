import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { MemoryIdeasFile } from '../app/testing/fakes.ts';
import { ideasFileContract } from './contracts/ideas-file.ts';
import { FsIdeasFile } from './fs-ideas-file.ts';

ideasFileContract('memory', async () => new MemoryIdeasFile());
ideasFileContract('file', async () => new FsIdeasFile(await mkdtemp(join(tmpdir(), 'ideas-'))));

it('writes writing/ideas.md', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ideas-'));
  await new FsIdeasFile(root).write('x');
  expect(await readFile(join(root, 'writing/ideas.md'), 'utf8')).toBe('x');
});
