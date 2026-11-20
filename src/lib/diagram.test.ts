import { describe, expect, it } from 'vitest';
import { bounds, boxExit, centre, CELL, edgeGeometry, NODE, PAD, validate, type Architecture, type DiagramNode } from './diagram';

const node = (id: string, x: number, y: number): DiagramNode => ({ id, label: id, kind: 'service', x, y });

describe('centre', () => {
  it('puts grid cells side by side after the padding', () => {
    expect(centre(0, 0)).toEqual({ x: PAD + CELL.w / 2, y: PAD + CELL.h / 2 });
    expect(centre(2, 1).x - centre(1, 1).x).toBe(CELL.w);
  });
});

describe('bounds', () => {
  it('covers the largest view and any via points below the last row', () => {
    const b = bounds([
      { label: 'a', nodes: [node('a', 0, 0), node('b', 3, 1)], edges: [] },
      { label: 'b', nodes: [node('c', 1, 2)], edges: [{ from: 'c', to: 'c', via: [[1, 2.5]] }] },
    ]);
    expect(b.width).toBe(PAD * 2 + 4 * CELL.w);
    expect(b.height).toBe(Math.ceil(PAD * 2 + 3.25 * CELL.h));
  });

  it('covers groups, with room for a stack peeking out behind', () => {
    const b = bounds([{ label: 'a', nodes: [node('a', 0, 0)], edges: [], groups: [{ label: 'g', x: 0, y: 1, w: 3, h: 1, stack: true }] }]);
    expect(b.width).toBe(Math.ceil(PAD * 2 + 3.1 * CELL.w));
    expect(b.height).toBe(Math.ceil(PAD * 2 + 2.15 * CELL.h));
  });
});

describe('boxExit', () => {
  it('leaves through the side facing the target', () => {
    const c = { x: 100, y: 100 };
    expect(boxExit(c, { x: 500, y: 100 }, 0)).toEqual({ x: 100 + NODE.w / 2, y: 100 });
    expect(boxExit(c, { x: 100, y: 0 }, 0)).toEqual({ x: 100, y: 100 - NODE.h / 2 });
  });
});

describe('edgeGeometry', () => {
  it('draws a straight line between neighbours', () => {
    const { d } = edgeGeometry(node('a', 0, 0), node('b', 1, 0));
    expect(d).toMatch(/^M[\d.]+,[\d.]+ L[\d.]+,[\d.]+$/);
  });
  it('rounds the corner at a via point', () => {
    const { d } = edgeGeometry(node('a', 0, 0), node('b', 2, 0), [[0, 1], [2, 1]]);
    expect(d.match(/Q/g)).toHaveLength(2);
  });
});

describe('validate', () => {
  const arch: Architecture = {
    description: 'test',
    after: { label: 'After', nodes: [node('a', 0, 0), node('b', 1, 0)], edges: [{ from: 'a', to: 'b' }] },
    flows: [{ label: 'f', steps: [{ edges: [['a', 'b']], note: 'go' }] }],
  };
  it('accepts consistent data', () => expect(validate(arch)).toEqual([]));
  it('reports unknown nodes, overlaps and flow steps with no edge', () => {
    const bad: Architecture = {
      ...arch,
      before: { label: 'Before', nodes: [node('a', 0, 0), node('c', 0, 0)], edges: [{ from: 'a', to: 'z' }] },
      flows: [{ label: 'f', steps: [{ edges: [['b', 'a']], note: 'back' }] }],
    };
    expect(validate(bad)).toEqual([
      'before: two nodes at 0,0',
      'before: edge to unknown node "z"',
      'flow "f": no edge b → a in the after view',
    ]);
  });
});
