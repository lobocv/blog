import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { linesBefore, rehypeSourceLines } from './source-lines.mjs';

const file = '---\ntitle: T\ndraft: true\n---\n\nFirst paragraph.\n\n## Heading\n';
const body = 'First paragraph.\n\n## Heading\n';

describe('linesBefore', () => {
  it('counts the front matter and blank lines above the body', () => expect(linesBefore(body, file)).toBe(5));
  it('is zero when the body is the whole file', () => expect(linesBefore(file, file)).toBe(0));
  it('is zero when the body is not in the file', () => expect(linesBefore('other', file)).toBe(0));
});

describe('rehypeSourceLines', () => {
  it('tags blocks with their line in the file', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'lines-')), 'index.md');
    writeFileSync(path, file);
    const el = (tagName: string, line: number, children: object[] = []) => ({
      type: 'element',
      tagName,
      properties: {},
      position: { start: { line } },
      children,
    });
    const tree = { type: 'root', children: [el('p', 1, [el('em', 1)]), el('h2', 3)] };
    rehypeSourceLines()(tree as any, { value: body, path } as any);
    const [p, h2] = tree.children as any[];
    expect(p.properties.dataLine).toBe(6);
    expect(h2.properties.dataLine).toBe(8);
    expect(p.children[0].properties.dataLine).toBeUndefined();
  });
});
