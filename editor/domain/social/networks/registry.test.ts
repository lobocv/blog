import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { networks } from './registry.ts';

it('lists every network folder, and each folder is named after its network', () => {
  const folders = readdirSync(import.meta.dirname).filter((f) => statSync(join(import.meta.dirname, f)).isDirectory());
  expect(networks.map((n) => n.id).sort()).toEqual(folders.sort());
});

it('gives each network its own id', () => {
  expect(new Set(networks.map((n) => n.id)).size).toBe(networks.length);
});
