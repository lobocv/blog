// Highlights the quoted text of each thread and note in CodeMirror. EditorView sets the marks;
// between updates they move with the text as Calvin types.
import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';

export type Mark = { from: number; to: number; className: string };

export const setMarks = StateEffect.define<Mark[]>();

export const threadMarks = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, tr) {
    let next = marks.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setMarks)) continue;
      const len = tr.state.doc.length;
      const ranges = e.value
        .filter((m) => m.from < m.to && m.to <= len)
        .sort((a, b) => a.from - b.from)
        .map((m) => Decoration.mark({ class: m.className }).range(m.from, m.to));
      next = Decoration.set(ranges, true);
    }
    return next;
  },
  provide: (f) => EditorView.decorations.from(f),
});
