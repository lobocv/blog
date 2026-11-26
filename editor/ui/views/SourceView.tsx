import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { yamlFrontmatter } from '@codemirror/lang-yaml';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { drawSelection, EditorView, keymap } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { useEffect, useRef } from 'preact/hooks';
import type { Range } from '../../domain/anchor.ts';
import { change } from '../../domain/merge.ts';
import { type Mark, setMarks, threadMarks } from './thread-marks.ts';

// Markdown markers (#, *, `) recede so the words stand out. Colours come from theme.css.
const highlight = HighlightStyle.define([
  { tag: t.heading, color: 'var(--ink)', fontWeight: '500' },
  { tag: [t.processingInstruction, t.meta, t.contentSeparator], color: 'var(--ink-3)' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strong, fontWeight: '600' },
  { tag: [t.link, t.url], color: 'var(--green)' },
  { tag: t.monospace, color: 'var(--ink)' },
  { tag: t.quote, color: 'var(--ink-3)' },
  // Front matter
  { tag: [t.propertyName, t.string, t.number, t.bool, t.keyword, t.squareBracket], color: 'var(--ink-3)' },
]);

/** What EditorView needs to keep Source and Preview on the same block. Lines count from 1. */
export type SourceHandle = {
  topLine(): number;
  scrollTo(line: number): void;
  focus(): void;
  selection(): Range;
  /** Drops the selection to a cursor at its end, so the next key doesn't replace the selected text. */
  collapse(): void;
  /** How far below the top of the text `pos` sits, in pixels. */
  topOf(pos: number): number;
  /** Scrolls `pos` to the middle of the screen. */
  reveal(pos: number): void;
  /** Replaces a range as if Calvin typed it, so ⌘Z undoes it. */
  replace(range: Range, text: string): void;
  /** Changes the text to `next` with the smallest edit, keeping the cursor where it can. ⌘Z undoes it. */
  setText(next: string): void;
};

type Props = {
  text: string;
  onChange: (text: string) => void;
  handle?: { current: SourceHandle | undefined };
  marks?: Mark[];
  /** Called when lines move (typing, wrapping, resizing), so the margin can follow. */
  onLayout?: () => void;
};

/** The post's Markdown in CodeMirror. Owns its own document after mounting. */
export function SourceView({ text, onChange, handle, marks = [], onLayout }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView>(undefined);
  const changed = useRef(onChange);
  changed.current = onChange;
  const laidOut = useRef(onLayout);
  laidOut.current = onLayout;

  useEffect(() => {
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: text,
        extensions: [
          history(),
          drawSelection(),
          // ⌘/ opens the shortcut sheet, so it can't also toggle a comment.
          keymap.of([...defaultKeymap.filter((b) => b.key !== 'Mod-/'), ...historyKeymap]),
          yamlFrontmatter({ content: markdown() }),
          syntaxHighlighting(highlight),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': 'Post source', spellcheck: 'true' }),
          threadMarks,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) changed.current(u.state.doc.toString());
            if (u.docChanged || u.geometryChanged || u.heightChanged) laidOut.current?.();
          }),
        ],
      }),
    });
    editor.current = view;
    view.focus();
    if (handle) handle.current = sourceHandle(view);
    return () => view.destroy();
  }, []);

  useEffect(() => {
    editor.current?.dispatch({ effects: setMarks.of(marks) });
  }, [marks]);

  return <div class="source" ref={host} />;
}

// The page scrolls, not CodeMirror, so the top line is whichever one sits at the scroller's top edge.
function sourceHandle(view: EditorView): SourceHandle {
  const scroller = () => view.dom.closest('.page') ?? document.documentElement;
  return {
    topLine() {
      const offset = scroller().getBoundingClientRect().top - view.documentTop;
      if (offset <= 0) return 1;
      return view.state.doc.lineAt(view.lineBlockAtHeight(offset).from).number;
    },
    scrollTo(line) {
      const { from } = view.state.doc.line(Math.max(1, Math.min(line, view.state.doc.lines)));
      view.dispatch({ selection: { anchor: from }, effects: EditorView.scrollIntoView(from, { y: 'start' }) });
    },
    focus: () => view.focus(),
    collapse: () => view.dispatch({ selection: { anchor: view.state.selection.main.to } }),
    selection: () => {
      const { from, to } = view.state.selection.main;
      return { from, to };
    },
    topOf: (pos) => {
      pos = Math.min(pos, view.state.doc.length);
      // The wrapped line the words are on when it's drawn, else the top of their paragraph.
      const coords = view.coordsAtPos(pos);
      return coords ? coords.top - view.documentTop : view.lineBlockAt(pos).top;
    },
    reveal: (pos) => view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'center' }) }),
    replace: ({ from, to }, insert) => view.dispatch({ changes: { from, to, insert }, userEvent: 'input' }),
    setText: (next) => {
      const c = change(view.state.doc.toString(), next);
      if (c.toA > c.from || c.toB > c.from) view.dispatch({ changes: { from: c.from, to: c.toA, insert: next.slice(c.from, c.toB) } });
    },
  };
}
