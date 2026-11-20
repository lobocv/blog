// System diagrams for project pages: data types plus the pure geometry that turns
// grid positions into SVG coordinates. Rendering is in src/components/project/SystemDiagram.astro,
// interaction in src/scripts/diagram.ts.

export type NodeKind = 'service' | 'store' | 'queue' | 'external' | 'client' | 'config';

export interface DiagramNode {
  id: string;
  label: string;
  /** Second line in small mono type, eg the technology */
  sub?: string;
  kind: NodeKind;
  /** Grid column and row; fractions are allowed */
  x: number;
  y: number;
  /** id of the Detail block opened when the node is clicked */
  detail?: string;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  /** Grid points the edge bends through, eg to route around a node */
  via?: [number, number][];
  /** dashed: configuration or a weak link. tangle: coupling we wanted to get rid of */
  style?: 'dashed' | 'tangle';
}

/** A labelled box drawn behind a block of cells, eg one lane of a pipeline */
export interface DiagramGroup {
  label: string;
  /** Top-left cell, then size in cells */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Draw copies peeking out behind it, for "and many more like this" */
  stack?: boolean;
}

export interface DiagramView {
  /** Button label, eg "Before" */
  label: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups?: DiagramGroup[];
}

export interface FlowStep {
  /** Edges animated together in this step, as [from, to] */
  edges: [string, string][];
  /** One line shown under the diagram while the step plays */
  note: string;
}

export interface Flow {
  label: string;
  steps: FlowStep[];
}

export interface Architecture {
  /** Alt-style summary of the diagram for screen readers */
  description: string;
  after: DiagramView;
  /** Not every project has a "before"; the toggle only appears when it does */
  before?: DiagramView;
  /** Played on the "after" view */
  flows?: Flow[];
}

export const CELL = { w: 200, h: 112 };
export const NODE = { w: 148, h: 54 };
export const PAD = 20;

type Point = { x: number; y: number };

/** Centre of a grid position in SVG units. */
export function centre(x: number, y: number): Point {
  return { x: PAD + x * CELL.w + CELL.w / 2, y: PAD + y * CELL.h + CELL.h / 2 };
}

/** viewBox covering every node of every view given, so toggling views never resizes the diagram. */
export function bounds(views: DiagramView[]): { width: number; height: number } {
  let cols = 1, rows = 1;
  for (const v of views) {
    for (const n of v.nodes) { cols = Math.max(cols, n.x + 1); rows = Math.max(rows, n.y + 1); }
    for (const e of v.edges) for (const [, y] of e.via ?? []) rows = Math.max(rows, y + 0.75);
    for (const g of v.groups ?? []) { cols = Math.max(cols, g.x + g.w + (g.stack ? 0.1 : 0)); rows = Math.max(rows, g.y + g.h + (g.stack ? 0.15 : 0)); }
  }
  return { width: Math.ceil(PAD * 2 + cols * CELL.w), height: Math.ceil(PAD * 2 + rows * CELL.h) };
}

/** Where the ray from a node's centre towards `toward` leaves its box (plus a small gap). */
export function boxExit(c: Point, toward: Point, gap = 6): Point {
  const dx = toward.x - c.x, dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const hw = NODE.w / 2 + gap, hh = NODE.h / 2 + gap;
  const t = Math.min(dx === 0 ? Infinity : hw / Math.abs(dx), dy === 0 ? Infinity : hh / Math.abs(dy));
  return { x: c.x + dx * t, y: c.y + dy * t };
}

const r = (n: number) => Math.round(n * 10) / 10;

/** SVG path for an edge, with rounded corners at `via` points, and where to put its label. */
export function edgeGeometry(from: DiagramNode, to: DiagramNode, via: [number, number][] = []): { d: string; at: Point } {
  const a = centre(from.x, from.y), b = centre(to.x, to.y);
  const mids = via.map(([x, y]) => centre(x, y));
  const start = boxExit(a, mids[0] ?? b);
  const end = boxExit(b, mids[mids.length - 1] ?? a);
  const pts = [start, ...mids, end];
  let d = `M${r(start.x)},${r(start.y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], prev = pts[i - 1], next = pts[i + 1];
    const k = 18;
    const inLen = Math.hypot(p.x - prev.x, p.y - prev.y), outLen = Math.hypot(next.x - p.x, next.y - p.y);
    const ki = Math.min(k, inLen / 2), ko = Math.min(k, outLen / 2);
    const p1 = { x: p.x - ((p.x - prev.x) / inLen) * ki, y: p.y - ((p.y - prev.y) / inLen) * ki };
    const p2 = { x: p.x + ((next.x - p.x) / outLen) * ko, y: p.y + ((next.y - p.y) / outLen) * ko };
    d += ` L${r(p1.x)},${r(p1.y)} Q${r(p.x)},${r(p.y)} ${r(p2.x)},${r(p2.y)}`;
  }
  d += ` L${r(end.x)},${r(end.y)}`;
  // Label sits on the middle of the longest segment
  let best = 0, lp: Point = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (len > best) { best = len; lp = { x: (pts[i].x + pts[i - 1].x) / 2, y: (pts[i].y + pts[i - 1].y) / 2 }; }
  }
  return { d, at: { x: r(lp.x), y: r(lp.y) } };
}

export const edgeKey = (from: string, to: string) => `${from}>${to}`;

/** Problems with an architecture's data, as readable messages. Empty when it is valid. */
export function validate(arch: Architecture): string[] {
  const errs: string[] = [];
  const views: [string, DiagramView | undefined][] = [['after', arch.after], ['before', arch.before]];
  for (const [name, v] of views) {
    if (!v) continue;
    const ids = new Set<string>();
    const cells = new Set<string>();
    for (const n of v.nodes) {
      if (ids.has(n.id)) errs.push(`${name}: duplicate node id "${n.id}"`);
      ids.add(n.id);
      const cell = `${n.x},${n.y}`;
      if (cells.has(cell)) errs.push(`${name}: two nodes at ${cell}`);
      cells.add(cell);
    }
    for (const e of v.edges) {
      if (!ids.has(e.from)) errs.push(`${name}: edge from unknown node "${e.from}"`);
      if (!ids.has(e.to)) errs.push(`${name}: edge to unknown node "${e.to}"`);
    }
  }
  const after = new Set(arch.after.edges.map(e => edgeKey(e.from, e.to)));
  for (const f of arch.flows ?? []) {
    for (const s of f.steps) for (const [a, b] of s.edges) {
      if (!after.has(edgeKey(a, b))) errs.push(`flow "${f.label}": no edge ${a} → ${b} in the after view`);
    }
  }
  return errs;
}
