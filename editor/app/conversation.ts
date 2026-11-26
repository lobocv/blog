// Claude's side of the threads: one turn at a time per post, each streamed to whoever is
// listening (the open editor), with its reply added to the thread when it finishes.
import { threadPrompt } from '../domain/prompt.ts';
import { reply, type Thread } from '../domain/thread.ts';
import type { Agent, Clock, PostLibrary, ThreadStore } from './ports.ts';

export type ConversationEvent =
  /** The threads changed (eg Claude's reply was added). */
  | { type: 'threads'; threads: Thread[] }
  /** Claude is working on `threadId`. `text` is its reply so far; `tool` what it's reading or running. */
  | { type: 'working'; threadId: string; text: string; tool?: string }
  | { type: 'idle' }
  | { type: 'failed'; threadId: string; message: string };

type Deps = {
  library: PostLibrary;
  threads: ThreadStore;
  clock: Clock;
  agent: Agent;
  /** The URL of the editor's MCP tools for a post (eg suggest_edit). */
  toolsUrl?: (slug: string) => string;
};
type Listener = (e: ConversationEvent) => void;

/** Per post: the running turn, the turns waiting behind it, and who's listening. */
type PostState = {
  chain: Promise<void>;
  waiting: number;
  current?: AbortController;
  generation: number;
  listeners: Set<Listener>;
  /** The latest progress of the running turn, for listeners that join late. */
  lastWorking?: ConversationEvent;
};

export function createConversation({ library, threads, clock, agent, toolsUrl }: Deps) {
  const posts = new Map<string, PostState>();
  const stateOf = (slug: string) => {
    let s = posts.get(slug);
    if (!s) posts.set(slug, (s = { chain: Promise.resolve(), waiting: 0, generation: 0, listeners: new Set() }));
    return s;
  };
  const publish = (slug: string, e: ConversationEvent) => {
    const s = stateOf(slug);
    if (e.type === 'working') s.lastWorking = e;
    else if (e.type !== 'threads') s.lastWorking = undefined;
    for (const l of s.listeners) l(e);
  };

  async function turn(slug: string, threadId: string, signal: AbortSignal) {
    const thread = (await threads.load(slug)).find((t) => t.id === threadId);
    if (!thread) return;
    publish(slug, { type: 'working', threadId, text: '' });
    let text = '';
    const result = await agent.ask(
      { prompt: threadPrompt(library.pathOf(slug), thread), session: await threads.session(slug), tools: toolsUrl?.(slug) },
      (e) => {
        if (e.type === 'text') text = e.text;
        publish(slug, { type: 'working', threadId, text, tool: e.type === 'tool' ? e.name : undefined });
      },
      signal,
    );
    if (result.session) await threads.saveSession(slug, result.session);
    const body = result.text.trim();
    if (!body) return;
    const next = reply(await threads.load(slug), threadId, {
      author: 'claude',
      text: result.stopped ? `${body} (stopped)` : body,
      at: clock.now().toISOString(),
    });
    if (!next) return;
    await threads.save(slug, next);
    publish(slug, { type: 'threads', threads: next });
  }

  return {
    /** Asks Claude to reply in a thread, after any turns already running or waiting. */
    ask(slug: string, threadId: string): Promise<void> {
      const s = stateOf(slug);
      const generation = s.generation;
      s.waiting++;
      s.chain = s.chain.then(async () => {
        s.waiting--;
        // Stopping drops the turns that were waiting.
        if (generation !== s.generation) return;
        const controller = (s.current = new AbortController());
        try {
          await turn(slug, threadId, controller.signal);
        } catch (err) {
          publish(slug, { type: 'failed', threadId, message: (err as Error).message });
        } finally {
          s.current = undefined;
          if (!s.waiting) publish(slug, { type: 'idle' });
        }
      });
      return s.chain;
    },

    /** Stops the running turn (keeping what Claude wrote so far) and drops the ones waiting. */
    stop(slug: string) {
      const s = stateOf(slug);
      s.generation++;
      s.current?.abort();
    },

    /** Tells listeners the threads changed during a turn (eg Claude suggested an edit). */
    changed(slug: string, list: Thread[]) {
      publish(slug, { type: 'threads', threads: list });
      // The turn is still running: say so again, so the editor keeps showing it.
      const s = stateOf(slug);
      if (s.current && s.lastWorking) publish(slug, s.lastWorking);
    },

    /** Calls `listener` with every event for the post. Starts with the turn in progress, if any. */
    subscribe(slug: string, listener: Listener): () => void {
      const s = stateOf(slug);
      s.listeners.add(listener);
      if (s.lastWorking) listener(s.lastWorking);
      return () => s.listeners.delete(listener);
    },
  };
}

export type Conversation = ReturnType<typeof createConversation>;
