import { computed, signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { anchorAt, anchorNear, lineOf } from '../../domain/anchor.ts';
import { type Section, sections, stats } from '../../domain/document.ts';
import { merge } from '../../domain/merge.ts';
import { openMechanical, openSuggestion, type Suggestion, target } from '../../domain/suggestion.ts';
import { PostEvent, type Post, routes } from '../../protocol.ts';
import { savePost } from '../api.ts';
import { createAutosave } from '../autosave.ts';
import { Margin } from '../components/Margin.tsx';
import { PageThread } from '../components/PageThread.tsx';
import { StatusLine, type View } from '../components/StatusLine.tsx';
import type { SuggestionActions } from '../components/SuggestionView.tsx';
import { describeKey } from '../keymap.ts';
import { createThreadState } from '../thread-state.ts';
import { KeySheet } from '../components/KeySheet.tsx';
import { SectionPicker } from '../components/SectionPicker.tsx';
import { type PreviewHandle, PreviewView } from './PreviewView.tsx';
import { type SourceHandle, SourceView } from './SourceView.tsx';
import type { Mark } from './thread-marks.ts';

/** One post: Source or Preview, the thread margin and the status line. */
export function EditorView({ post, onDrafts }: { post: Post; onDrafts: () => void }) {
  const { text, postStats, autosave, view, threads, layout, marks, clash, sheetOpen, lastKey, picking } = useMemo(() => {
    const text = signal(post.text);
    const threads = createThreadState(post.slug, text);
    return {
      text,
      threads,
      postStats: computed(() => stats(text.value)),
      autosave: createAutosave((t) => savePost(post.slug, t), undefined, undefined, post.text),
      // The file's text after an outside edit that clashed with Calvin's typing, until he chooses.
      clash: signal<string | undefined>(undefined),
      sheetOpen: signal(false),
      // The section picker's highlighted row (G), while it's open.
      picking: signal<number | undefined>(undefined),
      // Shown on the sheet, to tell when the system takes a key before the editor sees it.
      lastKey: signal<string | undefined>(undefined),
      view: signal<View>('source'),
      // Bumped when lines move in the source, so the margin follows.
      layout: signal(0),
      marks: computed<Mark[]>(() => {
        if (threads.hidden.value) return [];
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
    if (threads.hidden.value) return void preview.current?.mark([]);
    const lines = threads.items.value.map((i) => lineOf(t, i.range.from));
    const sel = threads.items.value.find((i) => i.id === threads.selected.value);
    preview.current?.mark(lines, sel && lineOf(t, sel.range.from));
  }, [threads.items.value, threads.selected.value, threads.hidden.value]);

  // G: open on the section at the top of the view.
  const openSections = () => {
    const top = (view.value === 'source' ? source.current?.topLine() : preview.current?.topLine()) ?? 1;
    const list = sections(text.value);
    picking.value = Math.max(0, list.findLastIndex((s) => s.line <= top));
  };
  const goTo = (s: Section) => {
    picking.value = undefined;
    if (view.value === 'source') source.current?.scrollTo(s.line);
    else preview.current?.scrollTo(s.line);
    backToWriting();
  };

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
  // ⇧A: every mechanical fix Claude suggested, applied one after another.
  const acceptMechanical = async () => {
    for (const s of openMechanical(threads.threads.value)) {
      if (target(text.value, s)) await actions.current.accept(s);
    }
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
      if (!['Meta', 'Alt', 'Control', 'Shift'].includes(e.key)) lastKey.value = describeKey(e);
      const only = (mod: 'alt' | 'meta' | 'none') =>
        e.altKey === (mod === 'alt') && e.metaKey === (mod === 'meta') && !e.ctrlKey;
      // In Source a thread key needs ⌥, since bare letters are typing. In Preview the letter alone
      // works too, and ⌥ still does (eg from a message box, where letters are text).
      const threadKey = (only('alt') || (view.value === 'preview' && only('none'))) && !e.shiftKey;
      const shiftKey = only(view.value === 'source' ? 'alt' : 'none') && e.shiftKey;
      const act = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      // Pressing the key that opened something closes it again.
      const close = (fn: () => void) =>
        act(() => {
          fn();
          backToWriting();
        });
      const composing = threads.composing.value;
      // The section picker takes J/K, the arrows and ↵ while it's open, with or without ⌥.
      const plain = (only('none') || only('alt')) && !e.shiftKey;
      if (picking.value !== undefined && plain) {
        const list = sections(text.value);
        const at = picking.value;
        if (e.code === 'KeyJ' || e.code === 'ArrowDown') return act(() => (picking.value = Math.min(list.length - 1, at + 1)));
        if (e.code === 'KeyK' || e.code === 'ArrowUp') return act(() => (picking.value = Math.max(0, at - 1)));
        if (e.code === 'Enter') return act(() => (list[at] ? goTo(list[at]) : close(() => (picking.value = undefined))));
        if (e.code === 'Escape' || e.code === 'KeyG') return close(() => (picking.value = undefined));
      }

      if (e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'KeyC' && threads.working.value) {
        act(() => void threads.stopClaude());
      } else if (only('alt') && e.code === 'KeyO') act(() => void leave());
      else if ((threadKey && e.code === 'KeyH') || (view.value === 'preview' && e.key === '?' && !e.metaKey && !e.altKey)) {
        act(() => (sheetOpen.value = !sheetOpen.value));
      }
      else if (only('meta') && e.code === 'Backslash') act(() => show(view.value === 'source' ? 'preview' : 'source'));
      else if (only('meta') && e.code === 'KeyK' && composing?.kind === 'comment') close(() => (threads.composing.value = undefined));
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
      } else if (e.code === 'Escape' && sheetOpen.value) act(() => (sheetOpen.value = false));
      else if (e.code === 'Escape' && (threads.pageOpen.value || threads.selected.value)) {
        act(() => {
          threads.pageOpen.value = false;
          threads.selected.value = undefined;
          backToWriting();
        });
      } else if (threadKey && e.code === 'KeyG') act(openSections);
      else if (threadKey && e.code === 'KeyZ') act(() => (threads.hidden.value = !threads.hidden.value));
      else if (threadKey && (e.code === 'KeyJ' || e.code === 'KeyK')) {
        act(() => {
          threads.hidden.value = false;
          const item = threads.move(e.code === 'KeyJ' ? 1 : -1);
          if (!item) return;
          if (view.value === 'source') source.current?.reveal(item.range.from);
          else preview.current?.scrollTo(lineOf(text.value, item.range.from));
        });
      } else if (threadKey && e.code === 'KeyT' && composing?.kind === 'tweak') close(() => (threads.composing.value = undefined));
      else if (threadKey && e.code === 'KeyR' && composing?.kind === 'reply') close(() => (threads.composing.value = undefined));
      else if ((threadKey || only('meta')) && e.code === 'Slash' && threads.pageOpen.value) close(() => (threads.pageOpen.value = false));
      else if ((threadKey || only('meta')) && e.code === 'Slash') act(() => (threads.pageOpen.value = true));
      else if (threadKey && ['KeyA', 'KeyX', 'KeyT'].includes(e.code) && threads.selectedSuggestion()) {
        act(() => {
          const s = threads.selectedSuggestion()!;
          const a = actions.current;
          if (e.code === 'KeyX') a.reject(s);
          else if (!a.applies(s)) threads.error.value = 'The words that suggestion replaces have changed.';
          else if (e.code === 'KeyA') void a.accept(s);
          else a.tweak(s);
        });
      } else if (shiftKey && e.code === 'KeyC') act(() => void threads.askPage('/critique line'));
      else if (shiftKey && e.code === 'KeyA') act(() => void acceptMechanical());
      else if (shiftKey && e.code === 'KeyN') act(() => void threads.askPage('/notes'));
      else if (threadKey && e.code === 'KeyR') act(() => threads.replyToSelected());
      else if (threadKey && e.code === 'KeyD') act(() => void threads.resolveSelected());
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
        {view.value === 'source' && !threads.hidden.value && (
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
      {picking.value !== undefined && (
        <SectionPicker sections={sections(text.value)} at={picking.value} onGo={goTo} onClose={() => (picking.value = undefined)} />
      )}
      {sheetOpen.value && <KeySheet lastKey={lastKey.value} onClose={() => (sheetOpen.value = false)} />}
      <StatusLine
        view={view.value}
        onView={show}
        stats={postStats.value}
        threads={threads.tally.value}
        threadsHidden={threads.hidden.value}
        claude={Boolean(threads.working.value)}
        onStop={() => void threads.stopClaude()}
        onKeys={() => (sheetOpen.value = !sheetOpen.value)}
        onPage={() => (threads.pageOpen.value = !threads.pageOpen.value)}
        save={autosave.state.value}
        onDrafts={() => void leave()}
      />
    </>
  );
}
