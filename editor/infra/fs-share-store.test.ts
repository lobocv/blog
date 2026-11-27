import { cp, mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Refused } from '../app/errors.ts';
import { MemoryShareStore } from '../app/testing/fakes.ts';
import { shareStoreContract } from './contracts/share-store.ts';
import { FsShareStore } from './fs-share-store.ts';

shareStoreContract('memory', async () => new MemoryShareStore());
shareStoreContract('files', async () => new FsShareStore(await mkdtemp(join(tmpdir(), 'share-'))));

const repo = () => mkdtemp(join(tmpdir(), 'share-'));
const dir = (root: string) => join(root, 'writing/share/a');
const put = async (root: string, text: string) => {
  await mkdir(dir(root), { recursive: true });
  await writeFile(join(dir(root), 'share.json'), text);
};
const empty = { schemaVersion: 1, networks: {} };

describe('FsShareStore', () => {
  it('writes share.json and a ready-to-paste file per network, and no temporary files', async () => {
    const root = await repo();
    await new FsShareStore(root).update('a', () => ({ state: empty, texts: { net: 'Hook.\n\n#AI', other: '' } }));
    expect((await readdir(dir(root))).sort()).toEqual(['net.txt', 'other.txt', 'share.json']);
    expect(await readFile(join(dir(root), 'net.txt'), 'utf8')).toBe('Hook.\n\n#AI\n');
    expect(await readFile(join(dir(root), 'share.json'), 'utf8')).toBe('{\n  "schemaVersion": 1,\n  "networks": {}\n}\n');
  });

  it('loads a file written by milestone 1', async () => {
    const root = await repo();
    await mkdir(dir(root), { recursive: true });
    await cp(join(import.meta.dirname, 'testdata/share/v1-share.json'), join(dir(root), 'share.json'));
    const state = await new FsShareStore(root).load('a');
    expect(state?.networks.linkedin).toMatchObject({ status: 'posted', versions: [{ text: 'Hook.' }], posted: { text: 'Hook.\n\nMore.' } });
  });

  it('fills in fields an older file lacks, and keeps ones it doesn\'t know', async () => {
    const root = await repo();
    await put(root, JSON.stringify({ schemaVersion: 1, future: 1, networks: { net: { image: { figure: 'Tree' }, versions: [{ text: 't', at: 'x' }] } } }));
    const store = new FsShareStore(root);
    const state = await store.load('a');
    expect(state?.networks.net).toEqual({ text: '', status: 'draft', image: { figure: 'Tree' }, versions: [{ text: 't', at: 'x', hashtags: [], author: 'calvin' }] });
    await store.update('a', (s) => ({ state: s!, texts: {} }));
    expect(JSON.parse(await readFile(join(dir(root), 'share.json'), 'utf8'))).toMatchObject({ future: 1, networks: { net: { image: { figure: 'Tree' } } } });
  });

  it.each([
    ['broken JSON', '{"schemaVersion": 1,'],
    ['the wrong shape', '{"networks": []}'],
    ['a newer format', '{"schemaVersion": 99, "networks": {}}'],
  ])('refuses %s, and leaves the file alone', async (_, text) => {
    const root = await repo();
    await put(root, text);
    const store = new FsShareStore(root);
    await expect(store.load('a')).rejects.toBeInstanceOf(Refused);
    await expect(store.update('a', () => ({ state: empty, texts: {} }))).rejects.toBeInstanceOf(Refused);
    expect(await readFile(join(dir(root), 'share.json'), 'utf8')).toBe(text);
  });

  it('refuses a network id that would make a bad file name', async () => {
    await expect(new FsShareStore(await repo()).update('a', () => ({ state: empty, texts: { '../x': 'no' } }))).rejects.toThrow("can't be a file name");
  });
});
