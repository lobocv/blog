// Enforces the import table in docs/editor/architecture.md ("Layers and what
// they may import"). Change the doc first, then this table.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

type Layer = 'domain' | 'app' | 'infra' | 'server' | 'ui' | 'protocol' | 'main' | 'shared' | 'blog';

const mayImport: Record<Layer, Layer[]> = {
  domain: ['shared'],
  app: ['domain'],
  infra: ['app', 'domain'],
  server: ['app', 'protocol'],
  ui: ['domain', 'protocol', 'shared'],
  protocol: ['domain'],
  main: ['domain', 'app', 'infra', 'server', 'protocol', 'shared'],
  shared: [],
  blog: ['shared'],
};

// Only infra, server and main.ts may touch Node itself.
const mayUseNode: Layer[] = ['infra', 'server', 'main', 'shared', 'blog'];

const root = resolve(import.meta.dirname, '..');

export function layerOf(path: string): Layer | undefined {
  const p = path.split(sep).join('/');
  if (p.startsWith('shared/')) return 'shared';
  if (p.startsWith('src/')) return 'blog';
  if (p === 'editor/main.ts') return 'main';
  if (p === 'editor/protocol.ts') return 'protocol';
  const m = p.match(/^editor\/(domain|app|infra|server|ui)\//);
  return m ? (m[1] as Layer) : undefined;
}

const importRe = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm;

export function importsOf(source: string): string[] {
  return [...source.matchAll(importRe)].map((m) => m[1] ?? m[2] ?? m[3]);
}

const nodeModules = new Set(builtinModules);
const isNode = (spec: string) => spec.startsWith('node:') || nodeModules.has(spec.split('/')[0]);

/** Returns one line per broken rule. `files` paths are relative to the repo root. */
export function violations(files: { path: string; source: string }[]): string[] {
  const out: string[] = [];
  for (const { path, source } of files) {
    const from = layerOf(path);
    if (!from) continue;
    for (const spec of importsOf(source)) {
      if (spec.startsWith('.')) {
        const target = relative(root, resolve(root, dirname(path), spec));
        const to = layerOf(target);
        if (target.startsWith('editor') && !to && from !== 'main') {
          out.push(`${path}: imports ${spec}, which is in no layer`);
        } else if (to && to !== from && !mayImport[from].includes(to)) {
          out.push(`${path}: ${from} may not import ${to} (${spec})`);
        }
      } else if (isNode(spec) && !mayUseNode.includes(from) && !path.match(/\.test\.tsx?$/)) {
        out.push(`${path}: ${from} may not use Node (${spec})`);
      }
    }
  }
  return out;
}

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(full);
    return /\.(ts|tsx|mjs|js|astro)$/.test(name) ? [full] : [];
  });
}

describe('editor architecture', () => {
  it('follows the import table', () => {
    const files = ['editor', 'shared', 'src']
      .flatMap((d) => sourceFiles(join(root, d)))
      .map((full) => ({ path: relative(root, full), source: readFileSync(full, 'utf8') }));
    expect(violations(files)).toEqual([]);
  });

  it('catches imports that break the table', () => {
    const found = violations([
      { path: 'editor/ui/main.tsx', source: "import { x } from '../app/accept-suggestion.ts';" },
      { path: 'editor/domain/anchor.ts', source: "import { readFile } from 'node:fs/promises';" },
      { path: 'editor/server/http.ts', source: "export { y } from '../infra/fs-document-store.ts';" },
      { path: 'src/lib/posts.ts', source: "const m = await import('../../editor/domain/thread.ts');" },
      { path: 'shared/notes.mjs', source: "import '../editor/ui/theme.css';" },
    ]);
    expect(found).toEqual([
      'editor/ui/main.tsx: ui may not import app (../app/accept-suggestion.ts)',
      'editor/domain/anchor.ts: domain may not use Node (node:fs/promises)',
      'editor/server/http.ts: server may not import infra (../infra/fs-document-store.ts)',
      'src/lib/posts.ts: blog may not import domain (../../editor/domain/thread.ts)',
      'shared/notes.mjs: shared may not import ui (../editor/ui/theme.css)',
    ]);
  });

  it('allows what the table allows', () => {
    expect(
      violations([
        { path: 'editor/ui/keymap.ts', source: "import { Thread } from '../domain/thread.ts';\nimport { m } from '../protocol.ts';" },
        { path: 'editor/infra/json-thread-store.ts', source: "import type { ThreadStore } from '../app/ports.ts';\nimport fs from 'node:fs';" },
        { path: 'editor/main.ts', source: "import { a } from './infra/claude-agent.ts';" },
        { path: 'editor/app/add-comment.test.ts', source: "import { fakes } from './testing/fakes.ts';" },
      ]),
    ).toEqual([]);
  });
});
