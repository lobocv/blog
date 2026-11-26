// Hides the head of the post in CodeMirror: the front matter, which the form above the source
// edits, and the MDX imports after it, which only place figures. The lines stay in the document,
// so line numbers (thread anchors, the preview's data-line) don't change. Only the form, outside
// edits and undo may change them; typing can't reach them.
import { Annotation, EditorSelection, EditorState, StateField, type Transaction } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';
import { splitFrontMatter } from '../../domain/document.ts';
import { readFrontMatter } from '../../domain/front-matter.ts';

/** On a transaction from the form or an outside edit, which may change the hidden lines. */
export const headEdit = Annotation.define<boolean>();

// Front matter longer than this isn't a post's.
const HEAD = 50_000;

/**
 * Where the visible text starts: after the front matter and any imports below it. 0 when the
 * front matter can't be read, so it shows as text to fix by hand.
 */
export function bodyStart(state: EditorState): number {
  const head = state.doc.sliceString(0, HEAD);
  if (!readFrontMatter(head)) return 0;
  let end = splitFrontMatter(head).frontMatter.length;
  // Imports, one per line or spread over several, with blank lines between them.
  const lines = head.slice(end).split('\n');
  let at = end;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      at += line.length + 1;
      continue;
    }
    if (!/^import\s/.test(line)) break;
    let last = i;
    while (last < lines.length - 1 && !/['"];?\s*$/.test(lines[last])) last++;
    for (; i <= last; i++) at += lines[i].length + 1;
    i--;
    end = Math.min(at, head.length);
  }
  // And the blank line after the imports: text typed straight below one would be read as part of it.
  const next = head.indexOf('\n', end);
  if (end > 0 && next !== -1 && !head.slice(end, next).trim() && /^import\s/m.test(head.slice(0, end))) end = next + 1;
  return end;
}

const hidden = StateField.define<{ start: number; lines: DecorationSet }>({
  create: (state) => place(state),
  update: (v, tr) => (tr.docChanged ? place(tr.state) : v),
  provide: (f) => [EditorView.decorations.from(f, (v) => v.lines), EditorView.atomicRanges.of((view) => view.state.field(f).lines)],
});

function place(state: EditorState) {
  const start = bodyStart(state);
  if (!start) return { start, lines: Decoration.none };
  // A block replace covers whole lines: up to the end of the closing ---, before its line break.
  const to = state.doc.sliceString(start - 1, start) === '\n' ? start - 1 : start;
  return { start, lines: Decoration.set([Decoration.replace({ block: true }).range(0, to)]) };
}

const trusted = (tr: Transaction) => Boolean(tr.annotation(headEdit)) || tr.isUserEvent('undo') || tr.isUserEvent('redo');

export const postHead = [
  hidden,
  // Typing, pasting or deleting never touches the hidden lines or the line break after them.
  EditorState.changeFilter.of((tr) => {
    const start = tr.startState.field(hidden).start;
    return !start || trusted(tr) ? true : [0, start];
  }),
  // The cursor stays in the body.
  EditorState.transactionFilter.of((tr) => {
    const start = tr.state.field(hidden).start;
    const sel = tr.newSelection;
    if (!start || !tr.selection || sel.ranges.every((r) => r.from >= start)) return tr;
    const moved = EditorSelection.create(sel.ranges.map((r) => EditorSelection.range(Math.max(r.anchor, start), Math.max(r.head, start))), sel.mainIndex);
    return [tr, { selection: moved, sequential: true }];
  }),
];
