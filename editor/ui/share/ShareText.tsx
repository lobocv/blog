// The share page's text box: CodeMirror, so highlights and the fold line are drawn in the same
// layout as the text and can't drift from it.
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { useEffect, useRef } from 'preact/hooks';
import { change } from '../../domain/merge.ts';
import { type Mark, setMarks, threadMarks } from '../views/thread-marks.ts';

export type ShareTextHandle = { focus(): void; setText(text: string): void };

type Props = {
  text: string;
  onChange: (text: string) => void;
  marks: Mark[];
  label: string;
  handle?: { current: ShareTextHandle | undefined };
};

/** Owns its document after mounting; `setText` replaces it (eg on Restore), and ⌘Z undoes that. */
export function ShareText({ text, onChange, marks, label, handle }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView>(undefined);
  const changed = useRef(onChange);
  changed.current = onChange;

  useEffect(() => {
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: text,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': label, spellcheck: 'true' }),
          placeholder('Write the post, or paste a draft'),
          threadMarks,
          EditorView.updateListener.of((u) => u.docChanged && changed.current(u.state.doc.toString())),
        ],
      }),
    });
    editor.current = view;
    if (handle)
      handle.current = {
        focus: () => view.focus(),
        setText: (next) => {
          const c = change(view.state.doc.toString(), next);
          if (c.toA > c.from || c.toB > c.from) view.dispatch({ changes: { from: c.from, to: c.toA, insert: next.slice(c.from, c.toB) } });
        },
      };
    return () => view.destroy();
  }, []);

  useEffect(() => {
    editor.current?.dispatch({ effects: setMarks.of(marks) });
  }, [marks]);

  return <div class="share-text" ref={host} />;
}
