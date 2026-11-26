import { computed, signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { anchorAt, anchorNear, lineOf } from '../../domain/anchor.ts';
import { stats } from '../../domain/document.ts';
import { merge } from '../../domain/merge.ts';
import { openSuggestion, type Suggestion, target } from '../../domain/suggestion.ts';
import { PostEvent, type Post, routes } from '../../protocol.ts';
import { savePost } from '../api.ts';
import { createAutosave } from '../autosave.ts';
import { Margin } from '../components/Margin.tsx';
import { PageThread } from '../components/PageThread.tsx';
import { StatusLine, type View } from '../components/StatusLine.tsx';
import type { SuggestionActions } from '../components/SuggestionView.tsx';
import { createThreadState } from '../thread-state.ts';
import { type PreviewHandle, PreviewView } from './PreviewView.tsx';
import { type SourceHandle, SourceView } from './SourceView.tsx';
import type { Mark } from './thread-marks.ts';

/** One post: Source or Preview, the thread margin and the status line. */
export function EditorView({ post, onDrafts }: { post: Post; onDrafts: () => void }) {
  const { text, postStats, autosave, view, threads, layout, marks, clash } = useMemo(() => {
    const text = signal(post.text);
    const threads = createThreadState(post.slug, text);
    return {
      text,
      threads,
      postStats: computed(() => stats(text.value)),
      autosave: createAutosave((t) => savePost(post.slug, t), undefined, undefined, post.text),
      // The file's text after an outside edit that clashed with Calvin's typing, until he chooses.
      clash: signal<string | undefined>(undefined),
      view: signal<View>('source'),
      // Bumped when lines move in the source, so the margin follows.
      layout: signal(0),
      marks: computed<Mark[]>(() => {
        const out: Mark[] = threads.items.value.map((i) => ({
          from: i.range.from,
          to: i.range.to,
          className: `cm-${i.kind}${threads.selected.value === i.id ? ' on' : ''}`,
        }));
        // The words the selected thread's suggestion would replace.
        const open = threads.threads.value.find((t) => t.id === threads.selected.value);
        const s = open && openSuggestion(open);
        const at = s && target(text.value, s);
        if (at) out.push({ ...at, className: 'cm-del' });
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
      const parsed = PostEvent.safeParse(JSON.parse(e.data));
      if (!parsed.success) return;
      if (parsed.data.type === 'outside') outsideEdit(parsed.data.text);
      else threads.apply(parsed.data);
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

  const suggestions: SuggestionActions = {
    applies: (s) => Boolean(target(text.value, s)),
    tweaking: threads.composing.value?.kind === 'tweak' ? threads.composing.value.suggestion.id : undefined,
    // Applied to the editor like Calvin's own typing (⌘Z undoes it), then saved by autosave.
    async accept(s: Suggestion, replace?: string) {
      const at = target(text.value, s);
      if (!at || !source.current) {
        threads.error.value = 'The words that suggestion replaces have changed.';
        return false;
      }
      source.current.replace(at, replace ?? s.replace);
      void autosave.flush();
      const ok = await threads.settle(s.id, 'accepted', replace);
      if (ok) backToWriting();
      return ok;
    },
    reject: (s) => void threads.settle(s.id, 'rejected'),
    tweak: (s) => (threads.composing.value = { kind: 'tweak', suggestion: s }),
    cancelTweak: () => {
      threads.composing.value = undefined;
      backToWriting();
    },
  };
  // Keys read this through a ref, since the handler is attached once.
  const actions = useRef(suggestions);
  actions.current = suggestions;

  // Something else changed the file: reload it, or merge it with typing that isn't saved yet.
  const outsideEdit = (theirs: string) => {
    const base = autosave.saved() ?? post.text;
    const mine = text.value;
    autosave.markSaved(theirs);
    if (theirs === mine) return;
    const merged = mine === base && !autosave.unsaved() ? theirs : merge(base, mine, theirs);
    if (merged === undefined) clash.value = theirs;
    else source.current?.setText(merged);
  };

  const resolveClash = (take: 'theirs' | 'mine') => {
    if (take === 'theirs' && clash.value !== undefined) source.current?.setText(clash.value);
    else autosave.change(text.value);
    clash.value = undefined;
    backToWriting();
  };

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
      } else if (threadKey && ['KeyA', 'KeyX', 'KeyT'].includes(e.code) && threads.selectedSuggestion()) {
        act(() => {
          const s = threads.selectedSuggestion()!;
          const a = actions.current;
          if (e.code === 'KeyX') a.reject(s);
          else if (!a.applies(s)) threads.error.value = 'The words that suggestion replaces have changed.';
          else if (e.code === 'KeyA') void a.accept(s);
          else a.tweak(s);
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
            suggestions={suggestions}
            onDone={backToWriting}
          />
        )}
      </main>
      <PreviewView
        slug={post.slug}
        text={text.value}
        threads={threads}
        suggestions={suggestions}
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
      {clash.value !== undefined && (
        <div class="notice" role="alert">
          <span>The post changed outside the editor while you were typing, in the same place.</span>
          <button type="button" class="btn" onClick={() => resolveClash('theirs')}>
            Use the outside version
          </button>
          <button type="button" class="btn" onClick={() => resolveClash('mine')}>
            Keep mine
          </button>
        </div>
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
