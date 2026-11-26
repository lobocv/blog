// Shows each figure under the line that places it in Source (see domain/figure-line.ts), so
// Calvin sees the real figure while he types. Components come from the preview server's page for
// one figure, which reloads when the figure's code changes; images load as they are.
import { type EditorState, type Extension, StateEffect, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { figureLine, figureUrl } from '../../domain/figure-line.ts';

/** Where figures come from: the preview server, and the post's path for its imports. */
export type FigureSource = { origin: string; path: string };

export const setFigureSource = StateEffect.define<FigureSource>();

class FigureWidget extends WidgetType {
  readonly url: string;
  readonly kind: 'component' | 'image';
  #stop: (() => void) | undefined;

  constructor(url: string, kind: 'component' | 'image') {
    super();
    this.url = url;
    this.kind = kind;
  }

  eq(other: FigureWidget) {
    return other.url === this.url;
  }

  get estimatedHeight() {
    return 240;
  }

  toDOM() {
    const box = document.createElement('div');
    box.className = 'cm-figure';
    if (this.kind === 'image') {
      const img = document.createElement('img');
      img.src = this.url;
      img.alt = '';
      box.append(img);
      return box;
    }
    const frame = document.createElement('iframe');
    frame.src = this.url;
    frame.title = 'Figure';
    frame.style.height = '240px';
    // The figure page says how tall it is.
    const onMessage = (e: MessageEvent) => {
      if (e.source === frame.contentWindow && e.data?.type === 'editor-figure-height') frame.style.height = `${e.data.height}px`;
    };
    window.addEventListener('message', onMessage);
    this.#stop = () => window.removeEventListener('message', onMessage);
    box.append(frame);
    return box;
  }

  destroy() {
    this.#stop?.();
  }

  // Clicks and keys inside the figure are the figure's (eg its buttons), not the editor's.
  ignoreEvent() {
    return true;
  }
}

const figures = StateField.define<{ source?: FigureSource; set: DecorationSet }>({
  create: () => ({ set: Decoration.none }),
  update(v, tr) {
    let source = v.source;
    for (const e of tr.effects) if (e.is(setFigureSource)) source = e.value;
    if (source === v.source && !tr.docChanged) return v;
    return { source, set: source ? place(tr.state, source) : Decoration.none };
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.set),
});

function place(state: EditorState, { origin, path }: FigureSource): DecorationSet {
  const text = state.doc.toString();
  const out = [];
  for (let n = 1; n <= state.doc.lines; n++) {
    const line = state.doc.line(n);
    // Cheap test first: figure lines start with < or !.
    if (!/^\s*[<!]/.test(line.text)) continue;
    const figure = figureLine(line.text, text, path);
    const url = figure && figureUrl(figure, origin);
    if (url) out.push(Decoration.widget({ widget: new FigureWidget(url, figure.kind), block: true, side: 1 }).range(line.to));
  }
  return Decoration.set(out);
}

export const figureWidgets: Extension = figures;
