import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { MemoryThreadStore } from '../app/testing/fakes.ts';
import { threadStoreContract } from './contracts/thread-store.ts';
import { JsonThreadStore } from './json-thread-store.ts';

threadStoreContract('memory', async () => new MemoryThreadStore());
threadStoreContract('json files', async () => new JsonThreadStore(await mkdtemp(join(tmpdir(), 'threads-'))));

it('writes writing/threads/<slug>.json', async () => {
  const root = await mkdtemp(join(tmpdir(), 'threads-'));
  await new JsonThreadStore(root).save('a', []);
  expect(await readFile(join(root, 'writing/threads/a.json'), 'utf8')).toBe('{\n  "threads": []\n}\n');
});

it('keeps the share threads in their own folder', async () => {
  const root = await mkdtemp(join(tmpdir(), 'threads-'));
  await new JsonThreadStore(root, 'writing/threads/share').save('a', []);
  expect(await readFile(join(root, 'writing/threads/share/a.json'), 'utf8')).toBe('{\n  "threads": []\n}\n');
  expect(await new JsonThreadStore(root).load('a')).toEqual([]);
});
