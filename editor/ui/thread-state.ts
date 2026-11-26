// The threads for the open post: what the server has, the `@@` notes in the text, which thread
// is selected and what Calvin is typing. Views read the signals; keys and buttons call the actions.
import { computed, type ReadonlySignal, signal } from '@preact/signals';
import { type Anchor, locate, type Range } from '../domain/anchor.ts';
import { openSuggestion, type Suggestion } from '../domain/suggestion.ts';
import { counts, type Message, notes, PAGE, type Thread } from '../domain/thread.ts';
import type { ClaudeEvent } from '../protocol.ts';
import * as defaultApi from './api.ts';

/** One entry in the margin, in the order it appears in the post. */
export type Item = { id: string; kind: 'thread' | 'note'; range: Range; messages: Message[] };

/** What the composer is for: a new comment on quoted text, a reply, or the page thread. */
export type Composing =
  | { kind: 'comment'; anchor: Anchor }
  | { kind: 'reply'; id: string }
  | { kind: 'page' }
  /** Calvin's version of a suggestion, before it's applied. */
  | { kind: 'tweak'; suggestion: Suggestion };

type Api = Pick<
  typeof defaultApi,
  'loadThreads' | 'addComment' | 'replyToThread' | 'resolveThread' | 'stopClaude' | 'settleSuggestion'
>;

/** Claude's reply in progress: the thread, the text so far, and the tool it's using. */
export type Working = { threadId: string; text: string; tool?: string };

export function createThreadState(slug: string, text: ReadonlySignal<string>, api: Api = defaultApi) {
  const threads = signal<Thread[]>([]);
  const selected = signal<string | undefined>(undefined);
  const composing = signal<Composing | undefined>(undefined);
  const pageOpen = signal(false);
  const error = signal<string | undefined>(undefined);
  const working = signal<Working | undefined>(undefined);

  const items = computed<Item[]>(() => {
    const t = text.value;
    const out: Item[] = [];
    for (const th of threads.value) {
      if (!th.anchor || th.resolved) continue;
      const range = locate(t, th.anchor);
      if (range) out.push({ id: th.id, kind: 'thread', range, messages: th.messages });
    }
    for (const n of notes(t)) {
      const range = locate(t, n.anchor);
      if (range) out.push({ id: n.id, kind: 'note', range, messages: [n.message] });
    }
    return out.sort((a, b) => a.range.from - b.range.from);
  });

  // Threads whose words are gone, judged against the text as Calvin types (the server does the same on save).
  const lost = computed(() =>
    threads.value.filter((th) => th.anchor && !th.resolved && !locate(text.value, th.anchor)),
  );
  const page = computed(() => threads.value.find((th) => th.id === PAGE));
  const tally = computed(() => counts(threads.value, notes(text.value).length));

  async function run(change: () => Promise<Thread[]>) {
    error.value = undefined;
    try {
      threads.value = await change();
      return true;
    } catch (err) {
      error.value = (err as Error).message;
      return false;
    }
  }

  return {
    threads,
    items,
    lost,
    page,
    tally,
    selected,
    composing,
    pageOpen,
    error,
    working,

    /** Applies an event from the server's stream of Claude's work. */
    apply(e: ClaudeEvent) {
      if (e.type === 'threads') threads.value = e.threads;
      else if (e.type === 'working') working.value = { threadId: e.threadId, text: e.text, tool: e.tool ?? working.value?.tool };
      else if (e.type === 'idle') working.value = undefined;
      else if (e.type === 'failed') {
        working.value = undefined;
        error.value = `Claude couldn't reply: ${e.message}`;
      }
    },

    /** Stops Claude's reply (⌃C). What it wrote so far is kept. */
    stopClaude: () => (working.value ? api.stopClaude(slug).catch(() => {}) : undefined),

    load: () => run(() => api.loadThreads(slug)),

    /** Sends what the composer holds. Resolves true when it was saved. */
    async send(body: string) {
      const c = composing.value;
      if (!c || c.kind === 'tweak' || !body.trim()) return false;
      const ok = await run(() =>
        c.kind === 'comment'
          ? api.addComment(slug, { anchor: c.anchor, text: body })
          : c.kind === 'reply'
            ? api.replyToThread(slug, c.id, { text: body })
            : api.addComment(slug, { text: body }),
      );
      if (ok) {
        composing.value = undefined;
        // Select the new thread, so J/K carry on from it.
        if (c.kind === 'comment') selected.value = threads.value.at(-1)?.id;
      }
      return ok;
    },

    /** Only threads can be resolved. A note goes away when Calvin deletes it from the post. */
    async resolveSelected() {
      const id = selected.value;
      if (!id || !threads.value.some((th) => th.id === id)) return;
      if (await run(() => api.resolveThread(slug, id))) selected.value = undefined;
    },

    replyToSelected() {
      const id = selected.value;
      if (id && threads.value.some((th) => th.id === id)) composing.value = { kind: 'reply', id };
    },

    /** The selected thread's suggestion waiting on Calvin, if any. */
    selectedSuggestion(): Suggestion | undefined {
      const t = threads.value.find((th) => th.id === selected.value);
      return t && openSuggestion(t);
    },

    /** Records an accepted (after the editor applied it) or rejected suggestion. */
    async settle(id: string, status: 'accepted' | 'rejected', replace?: string) {
      const ok = await run(() => api.settleSuggestion(slug, id, { status, replace }));
      if (ok && composing.value?.kind === 'tweak') composing.value = undefined;
      return ok;
    },

    /** Selects the next (1) or previous (-1) thread in the margin. Returns it. */
    move(by: 1 | -1): Item | undefined {
      const list = items.value;
      if (!list.length) return undefined;
      const at = list.findIndex((i) => i.id === selected.value);
      const next = at === -1 ? (by === 1 ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, at + by));
      selected.value = list[next].id;
      return list[next];
    },
  };
}

export type ThreadState = ReturnType<typeof createThreadState>;
