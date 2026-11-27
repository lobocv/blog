import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { Refused } from '../app/errors.ts';
import { MemoryShortLinks } from '../app/testing/fakes.ts';
import { shortLinksContract } from './contracts/short-links.ts';
import { FsShortLinks } from './fs-short-links.ts';

shortLinksContract('memory', async () => new MemoryShortLinks());
shortLinksContract('data file', async () => new FsShortLinks(await mkdtemp(join(tmpdir(), 'links-'))));

it('writes src/data/short-links.json sorted by code, one link per entry', async () => {
  const root = await mkdtemp(join(tmpdir(), 'links-'));
  const links = new FsShortLinks(root);
  await links.add('zzzzzz', { post: 'b', to: '/posts/b/' });
  await links.add('aaaaaa', { post: 'a', to: '/posts/a/' });
  expect(await readFile(join(root, 'src/data/short-links.json'), 'utf8')).toBe(
    '{\n  "aaaaaa": {\n    "post": "a",\n    "to": "/posts/a/"\n  },\n  "zzzzzz": {\n    "post": "b",\n    "to": "/posts/b/"\n  }\n}\n',
  );
});

it("refuses to add to a file it can't read, leaving it alone", async () => {
  const root = await mkdtemp(join(tmpdir(), 'links-'));
  await mkdir(join(root, 'src/data'), { recursive: true });
  await writeFile(join(root, 'src/data/short-links.json'), '{ broken');
  await expect(new FsShortLinks(root).add('aaaaaa', { post: 'a', to: '/posts/a/' })).rejects.toBeInstanceOf(Refused);
  expect(await readFile(join(root, 'src/data/short-links.json'), 'utf8')).toBe('{ broken');
});
