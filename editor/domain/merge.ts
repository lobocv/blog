// Merging an outside edit (eg Claude Code in a terminal, or Zed) into the editor while Calvin
// has typing that isn't saved yet. Each side's change is taken as one region (what lies between
// the common start and end), which covers the usual case of edits in different paragraphs.

/** The part of `a` that differs from `b`: a[from, toA) became b[from, toB). */
export type Change = { from: number; toA: number; toB: number };

/** The smallest single change that turns `a` into `b`. */
export function change(a: string, b: string): Change {
  let start = 0;
  const max = Math.min(a.length, b.length);
  while (start < max && a[start] === b[start]) start++;
  let end = 0;
  while (end < max - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;
  return { from: start, toA: a.length - end, toB: b.length - end };
}

/** Like `change`, but on whole lines, so a region never starts or ends inside a line. */
export function lineChange(a: string, b: string): Change {
  const la = a.split(/(?<=\n)/);
  const lb = b.split(/(?<=\n)/);
  let start = 0;
  const max = Math.min(la.length, lb.length);
  while (start < max && la[start] === lb[start]) start++;
  let end = 0;
  while (end < max - start && la[la.length - 1 - end] === lb[lb.length - 1 - end]) end++;
  const from = la.slice(0, start).join('').length;
  return { from, toA: a.length - la.slice(la.length - end).join('').length, toB: b.length - lb.slice(lb.length - end).join('').length };
}

/**
 * Applies both sides' changes to `base`. Undefined when they change the same lines, so Calvin
 * has to choose: two edits to one sentence rarely combine into what either side meant.
 */
export function merge(base: string, mine: string, theirs: string): string | undefined {
  if (mine === base) return theirs;
  if (theirs === base || theirs === mine) return mine;
  const m = lineChange(base, mine);
  const t = lineChange(base, theirs);
  // Apply the later change first, so the earlier one's positions still hold.
  const [first, firstText, second, secondText] = m.from <= t.from ? [m, mine, t, theirs] : [t, theirs, m, mine];
  // Regions are whole lines, so they clash when they overlap, or when both insert at one place.
  if (first.toA > second.from || (first.from === second.from && first.toA === first.from && second.toA === second.from)) return undefined;
  const withSecond = base.slice(0, second.from) + secondText.slice(second.from, second.toB) + base.slice(second.toA);
  return withSecond.slice(0, first.from) + firstText.slice(first.from, first.toB) + withSecond.slice(first.toA);
}
