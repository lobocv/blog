// Enforces the import table in docs/editor/architecture.md ("Layers and what
// they may import"). Change the doc first, then this table.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
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

// The no-branching rule in docs/editor/sharing-design.md ("Networks"): shared code never asks
// which network it has. Only the registry imports network modules, and outside the network
// folders, the registry and the preview components, no code names a network.
const networksDir = 'editor/domain/social/networks/';
const registry = `${networksDir}registry.ts`;
const previewsDir = 'editor/ui/share/previews/';

/** The network ids: one folder each under the networks folder. */
export function networkIds(): string[] {
  const dir = join(root, networksDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory());
}

/** The network a path belongs to, when it's inside a network's folder. */
const networkOf = (path: string) => path.split(sep).join('/').match(/^editor\/domain\/social\/networks\/([^/]+)\//)?.[1];

/**
 * Returns one line per broken rule. Short ids (eg `x`) are too common to search for as text, so
 * for those only string literals count. Longer ones count anywhere, comments and identifiers included.
 */
export function branching(files: { path: string; source: string }[], ids: string[]): string[] {
  const out: string[] = [];
  for (const { path, source } of files) {
    const p = path.split(sep).join('/');
    if (!/^(editor|shared)\//.test(p) || /\.test\.tsx?$/.test(p)) continue;
    const own = networkOf(p);
    const exempt = own !== undefined || p === registry || p.startsWith(previewsDir);
    const file = ts.createSourceFile(p, source, ts.ScriptTarget.Latest, true, p.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

    const visit = (node: ts.Node) => {
      // Imports, static and dynamic.
      let spec: ts.Expression | undefined;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) spec = node.moduleSpecifier;
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) spec = node.arguments[0];
      if (spec) {
        if (!ts.isStringLiteralLike(spec)) out.push(`${p}: imports a computed path`);
        else if (spec.text.startsWith('.')) {
          const target = networkOf(relative(root, resolve(root, dirname(p), spec.text)));
          if (target && p !== registry && target !== own) out.push(`${p}: imports the ${target} network (only the registry may)`);
        }
      }
      if (ts.isPropertyAccessExpression(node) && node.getText().startsWith('import.meta.glob')) out.push(`${p}: imports a computed path`);
      if (!exempt && ts.isStringLiteralLike(node) && ids.includes(node.text)) out.push(`${p}: names the ${node.text} network`);
      ts.forEachChild(node, visit);
    };
    visit(file);

    if (!exempt) {
      for (const id of ids.filter((i) => i.length >= 4)) {
        const at = source.toLowerCase().indexOf(id.toLowerCase());
        if (at >= 0) out.push(`${p}:${source.slice(0, at).split('\n').length}: names the ${id} network`);
      }
    }
  }
  return [...new Set(out)];
}

describe('no branching on networks', () => {
  it('holds across the editor', () => {
    const files = ['editor', 'shared']
      .flatMap((d) => sourceFiles(join(root, d)))
      .map((full) => ({ path: relative(root, full), source: readFileSync(full, 'utf8') }));
    expect(branching(files, networkIds())).toEqual([]);
  });

  const ids = ['linkedin', 'x'];

  it('catches code that names or imports a network', () => {
    expect(
      branching(
        [
          { path: 'editor/app/open-share.ts', source: "import { linkedin } from '../domain/social/networks/linkedin/index.ts';" },
          { path: 'editor/ui/views/ShareView.tsx', source: "if (network.id === 'x') {}" },
          { path: 'editor/ui/keymap.ts', source: "// Opens LinkedIn\nconst a = 1;" },
          { path: 'editor/domain/social/checks.ts', source: 'const limits = { linkedIn: 3000 };' },
          { path: 'editor/domain/social/networks/x/index.ts', source: "import { linkedin } from '../linkedin/index.ts';" },
          { path: 'editor/domain/social/networks/registry.ts', source: 'const all = await import(`./${id}/index.ts`);' },
          { path: 'editor/server/http.ts', source: "switch (id) { case 'x': break; }" },
          { path: 'shared/site.ts', source: 'const m = import.meta.glob("./networks/*");' },
        ],
        ids,
      ),
    ).toEqual([
      'editor/app/open-share.ts: imports the linkedin network (only the registry may)',
      'editor/app/open-share.ts:1: names the linkedin network',
      'editor/ui/views/ShareView.tsx: names the x network',
      'editor/ui/keymap.ts:1: names the linkedin network',
      'editor/domain/social/checks.ts:1: names the linkedin network',
      'editor/domain/social/networks/x/index.ts: imports the linkedin network (only the registry may)',
      'editor/domain/social/networks/registry.ts: imports a computed path',
      'editor/server/http.ts: names the x network',
      'shared/site.ts: imports a computed path',
    ]);
  });

  it('allows the registry, network folders, previews, tests and short ids as plain words', () => {
    expect(
      branching(
        [
          { path: 'editor/domain/social/networks/registry.ts', source: "import { linkedin } from './linkedin/index.ts';" },
          { path: 'editor/domain/social/networks/linkedin/index.ts', source: "export const composeUrl = 'https://www.linkedin.com/feed/?shareActive=true';\nimport { f } from './fold.ts';" },
          { path: 'editor/ui/share/previews/index.ts', source: "export const previews = { linkedin: LinkedIn, x: X };" },
          { path: 'editor/app/open-share.test.ts', source: "expect(files['linkedin.txt']).toBe('');" },
          { path: 'editor/ui/keymap.ts', source: "const s = { action: 'Reject suggestion', keys: 'X' }; const r = rect.x;" },
          { path: 'src/lib/share.ts', source: "export type ShareNetwork = 'linkedin' | 'x';" },
        ],
        ids,
      ),
    ).toEqual([]);
  });
});
