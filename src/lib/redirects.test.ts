import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { legacyRedirects } from './redirects.mjs';

const site = (posts: Record<string, string>) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'posts-'));
  for (const [slug, fm] of Object.entries(posts)) { fs.mkdirSync(path.join(dir, slug)); fs.writeFileSync(path.join(dir, slug, 'index.md'), `---\n${fm}\n---\nbody`); }
  return dir;
};

describe('legacyRedirects', () => {
  it('redirects each published category to the filtered index', () => {
    const r = legacyRedirects(site({ a: 'draft: false\ncategories: ["Developer Efficiency", "Golang"]' }));
    expect(r['/categories/developer-efficiency']).toBe('/posts/?cat=Developer Efficiency');
    expect(r['/categories/golang']).toBe('/posts/?cat=Golang');
    expect(r['/categories']).toBe('/posts/');
    expect(r['/tags']).toBe('/posts/');
  });
  it('skips categories that only drafts use', () => {
    const r = legacyRedirects(site({ a: 'categories: ["Golang"]', d: 'draft: true\ncategories: ["Secret"]' }));
    expect(r['/categories/secret']).toBeUndefined();
    expect(r['/categories/golang']).toBeDefined();
  });
  it('reads YAML block lists too', () => {
    const r = legacyRedirects(site({ a: 'categories:\n  - Databases\n  - "Architecture"' }));
    expect(r['/categories/databases']).toBe('/posts/?cat=Databases');
    expect(r['/categories/architecture']).toBe('/posts/?cat=Architecture');
  });
});
