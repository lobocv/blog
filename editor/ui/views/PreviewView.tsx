import { useEffect, useRef, useState } from 'preact/hooks';
import { lineOf } from '../../domain/anchor.ts';
import { type BlockPlace, type FromPage, lastAtOrAbove, postPath, type ToPage } from '../../../shared/preview.ts';
import { loadPreviewOrigin } from '../api.ts';
import { Margin } from '../components/Margin.tsx';
import type { SuggestionActions } from '../components/SuggestionView.tsx';
import type { ThreadState } from '../thread-state.ts';

/** What EditorView needs from the preview: keeping it on the same block as Source, and threads. */
export type PreviewHandle = {
  topLine(): number;
  scrollTo(line: number): void;
  focus(): void;
  /** What Calvin last selected in the page with ⌘K, and the line of its block. */
  selection(): { line: number; text: string } | undefined;
  /** Highlights the blocks holding these lines. */
  mark(lines: number[], selected?: number): void;
};

type Props = {
  slug: string;
  text: string;
  threads: ThreadState;
  suggestions: SuggestionActions;
  handle?: { current: PreviewHandle | undefined };
  hidden: boolean;
  onDone: () => void;
};

/**
 * The real page from `astro dev`, which reloads by itself when the post is saved. Threads float
 * at the right edge beside the block they're in, so the page keeps its full width.
 */
export function PreviewView({ slug, text, threads, suggestions, handle, hidden, onDone }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [origin, setOrigin] = useState<string>();
  const [error, setError] = useState<string>();
  const [blocks, setBlocks] = useState<BlockPlace[]>([]);
  // Where the page is scrolled to, and where it should be after the next reload.
  const line = useRef(1);
  const selection = useRef<{ line: number; text: string }>(undefined);
  // Sent again when the page reloads.
  const marks = useRef<ToPage>({ type: 'marks', lines: [] });

  // Started on load. If Astro failed (eg a post's front matter was broken), swapping to the preview tries again.
  const loading = useRef(false);
  useEffect(() => {
    if (origin || loading.current || (error && hidden)) return;
    loading.current = true;
    setError(undefined);
    loadPreviewOrigin()
      .then(setOrigin, (err: Error) => setError(err.message))
      .finally(() => (loading.current = false));
  }, [hidden]);

  // Set straight away: Calvin may swap to the preview before Astro is ready.
  const send = (msg: ToPage) => origin && frame.current?.contentWindow?.postMessage(msg, origin);
  if (handle) {
    handle.current = {
      topLine: () => line.current,
      // Remembered, so the page scrolls there once it has loaded.
      scrollTo: (l) => send({ type: 'scrollTo', line: (line.current = l) }),
      focus: () => frame.current?.focus(),
      selection: () => selection.current,
      mark: (lines, selected) => send((marks.current = { type: 'marks', lines, selected })),
    };
  }

  useEffect(() => {
    if (!origin) return;
    const onMessage = (e: MessageEvent<FromPage>) => {
      if (e.origin !== origin || e.source !== frame.current?.contentWindow) return;
      const msg = e.data;
      if (msg.type === 'ready') {
        send({ type: 'scrollTo', line: line.current });
        send(marks.current);
      } else if (msg.type === 'at') line.current = msg.line;
      else if (msg.type === 'blocks') setBlocks(msg.blocks);
      else if (msg.type === 'key') {
        selection.current = msg.selection;
        // A focused iframe gets the keys, so replay them here for the editor's shortcuts.
        window.dispatchEvent(new KeyboardEvent('keydown', { ...msg, bubbles: true, cancelable: true }));
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [origin]);

  // A thread floats beside the block holding its first line. Off-screen blocks put it out of view.
  const topOf = (pos: number) => lastAtOrAbove(blocks, lineOf(text, pos), (b) => b.line)?.top ?? -10_000;

  return (
    <main class="page page-preview" hidden={hidden}>
      {error ? (
        <p class="preview-note preview-error">{error}</p>
      ) : origin ? (
        <iframe
          ref={frame}
          class="preview"
          title="Post preview"
          src={origin + postPath(slug)}
          // Calvin may have swapped to the preview while it was loading.
          onLoad={() => !hidden && frame.current?.focus()}
        />
      ) : (
        <p class="preview-note">Starting the preview</p>
      )}
      {!hidden && origin && !threads.hidden.value && (
        <Margin
          state={threads}
          text={text}
          topOf={topOf}
          layout={0}
          keyPrefix=""
          suggestions={suggestions}
          class="margin-float"
          onDone={onDone}
        />
      )}
    </main>
  );
}
