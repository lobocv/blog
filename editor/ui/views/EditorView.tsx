import { computed, signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { anchorAt, anchorNear, lineOf } from '../../domain/anchor.ts';
import { stats } from '../../domain/document.ts';
import { ClaudeEvent, type Post, routes } from '../../protocol.ts';
import { savePost } from '../api.ts';
import { createAutosave } from '../autosave.ts';
import { Margin } from '../components/Margin.tsx';
import { PageThread } from '../components/PageThread.tsx';
import { StatusLine, type View } from '../components/StatusLine.tsx';
import { createThreadState } from '../thread-state.ts';
import { type PreviewHandle, PreviewView } from './PreviewView.tsx';
import { type SourceHandle, SourceView } from './SourceView.tsx';
import type { Mark } from './thread-marks.ts';

/** One post: Source or Preview, the thread margin and the status line. */
export function EditorView({ post, onDrafts }: { post: Post; onDrafts: () => void }) {
  const { text, postStats, autosave, view, threads, layout, marks } = useMemo(() => {
    const text = signal(post.text);
    const threads = createThreadState(post.slug, text);
    return {
      text,
      threads,
      postStats: computed(() => stats(text.value)),
      autosave: createAutosave((t) => savePost(post.slug, t)),
      view: signal<View>('source'),
      // Bumped when lines move in the source, so the margin follows.
      layout: signal(0),
      marks: computed<Mark[]>(() => {
        const out = threads.items.value.map((i) => ({
          from: i.range.from,
          to: i.range.to,
          className: `cm-${i.kind}${threads.selected.value === i.id ? ' on' : ''}`,
        }));
        return out;
      }),
    };
  }, [post]);
  const source = useRef<SourceHandle>(undefined);
  const preview = useRef<PreviewHandle>(undefined);

  // Load the threads, then follow Claude's replies as the server streams them.
  useEffect(() => {
    void threads.load();
    const events = new EventSource(routes.events(post.slug));
    events.onmessage = (e) => {
      const parsed = ClaudeEvent.safeParse(JSON.parse(e.data));
      if (parsed.success) threads.apply(parsed.data);
    };
    return () => events.close();
  }, [threads]);

  const leave = () => autosave.flush().then(onDrafts);

  // Both views stay mounted, so swapping keeps the editor's undo history and the loaded page.
  const show = (next: View) => {
    if (next === view.value) return;
    void autosave.flush();
    if (next === 'preview') {
      preview.current?.scrollTo(source.current?.topLine() ?? 1);
      view.value = next;
      preview.current?.focus();
    } else {
      view.value = next;
      source.current?.scrollTo(preview.current?.topLine() ?? 1);
      source.current?.focus();
    }
  };

  // ⌘K in the preview: the selected words when the source has them, else the block's first line.
  const commentFromPreview = () => {
    const sel = preview.current?.selection();
    return sel ? anchorNear(text.value, sel.text, sel.line) : undefined;
  };

  // Highlight the blocks with threads in the preview.
  useEffect(() => {
    const t = text.peek();
    const lines = threads.items.value.map((i) => lineOf(t, i.range.from));
    const sel = threads.items.value.find((i) => i.id === threads.selected.value);
    preview.current?.mark(lines, sel && lineOf(t, sel.range.from));
  }, [threads.items.value, threads.selected.value]);

  const backToWriting = () => {
    if (view.value === 'source') {
      // The text Calvin commented on is often still selected.
      source.current?.collapse();
      source.current?.focus();
    } else preview.current?.focus();
  };

  useLayoutEffect(() => {
    // Save straight away when Calvin leaves the window or closes it.
    const flush = () => void autosave.flush();
    const onKey = (e: KeyboardEvent) => {
      const only = (mod: 'alt' | 'meta' | 'none') =>
        e.altKey === (mod === 'alt') && e.metaKey === (mod === 'meta') && !e.ctrlKey;
      // In Source a thread key needs ⌥, since bare letters are typing. In Preview it's the letter alone.
      const threadKey = only(view.value === 'source' ? 'alt' : 'none') && !e.shiftKey;
      const act = (fn: () => void) => {
        e.preventDefault();
        fn();
      };

      if (e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'KeyC' && threads.working.value) {
        act(() => void threads.stopClaude());
      } else if (only('alt') && e.code === 'KeyO') act(() => void leave());
      else if (only('meta') && e.code === 'Backslash') act(() => show(view.value === 'source' ? 'preview' : 'source'));
      else if (only('meta') && e.code === 'KeyK') {
        act(() => {
          const anchor =
            view.value === 'source'
              ? source.current && anchorAt(text.value, source.current.selection())
              : commentFromPreview();
          if (!anchor) return;
          threads.pageOpen.value = false;
          threads.composing.value = { kind: 'comment', anchor };
        });
      } else if (e.code === 'Escape' && (threads.pageOpen.value || threads.selected.value)) {
        act(() => {
          threads.pageOpen.value = false;
          threads.selected.value = undefined;
          backToWriting();
        });
      } else if (threadKey && (e.code === 'KeyJ' || e.code === 'KeyK')) {
        act(() => {
          const item = threads.move(e.code === 'KeyJ' ? 1 : -1);
          if (!item) return;
          if (view.value === 'source') source.current?.reveal(item.range.from);
          else preview.current?.scrollTo(lineOf(text.value, item.range.from));
        });
      } else if (threadKey && e.code === 'KeyR') act(() => threads.replyToSelected());
      else if (threadKey && e.code === 'KeyD') act(() => void threads.resolveSelected());
      else if (threadKey && e.code === 'KeyP') act(() => (threads.pageOpen.value = !threads.pageOpen.value));
    };
    window.addEventListener('blur', flush);
    window.addEventListener('pagehide', flush);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('blur', flush);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('keydown', onKey);
    };
  }, [autosave, threads]);

  return (
    <>
      <main class="page" hidden={view.value !== 'source'}>
        <div class="column">
          <SourceView
            text={post.text}
            handle={source}
            marks={marks.value}
            onLayout={() => layout.value++}
            onChange={(next) => {
              text.value = next;
              autosave.change(next);
            }}
          />
        </div>
        {view.value === 'source' && (
          <Margin
            state={threads}
            text={text.value}
            topOf={(pos) => source.current?.topOf(pos) ?? 0}
            layout={layout.value}
            keyPrefix="⌥"
            onDone={backToWriting}
          />
        )}
      </main>
      <PreviewView
        slug={post.slug}
        text={text.value}
        threads={threads}
        handle={preview}
        hidden={view.value !== 'preview'}
        onDone={backToWriting}
      />
      {threads.pageOpen.value && (
        <PageThread
          state={threads}
          onClose={() => {
            threads.pageOpen.value = false;
            backToWriting();
          }}
        />
      )}
      <StatusLine
        view={view.value}
        onView={show}
        stats={postStats.value}
        threads={threads.tally.value}
        claude={Boolean(threads.working.value)}
        onStop={() => void threads.stopClaude()}
        onPage={() => (threads.pageOpen.value = !threads.pageOpen.value)}
        save={autosave.state.value}
        onDrafts={() => void leave()}
      />
    </>
  );
}
