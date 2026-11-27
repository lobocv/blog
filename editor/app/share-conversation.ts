// Claude on the share page: its own thread and session per post, separate from the post's
// writing threads, so share talk doesn't fill up the writing conversation.
import { checkPost } from '../domain/social/checks.ts';
import { postFigures } from '../domain/social/figures.ts';
import { networks } from '../domain/social/networks/registry.ts';
import { resolvePost } from '../domain/social/resolve.ts';
import { sharePrompt } from '../domain/social/share-prompt.ts';
import { markNoted, type ShareState, unnotedRewrite, type Version } from '../domain/social/social-post.ts';
import { comment, PAGE, type Thread } from '../domain/thread.ts';
import { createConversation } from './conversation.ts';
import type { Agent, AgentTurn, Clock, PostLibrary, ShareStore, ThreadStore } from './ports.ts';
import { fill, publishedPost, texts } from './share-post.ts';

type Deps = {
  library: PostLibrary;
  share: ShareStore;
  /** The share threads (writing/threads/share/), one per post, under the page thread's id. */
  threads: ThreadStore;
  clock: Clock;
  agent: Agent;
  toolsUrl?: (slug: string) => string;
  turn?: Pick<AgentTurn, 'system' | 'allow'>;
};

export function createShareConversation(deps: Deps) {
  const { library, share, threads, clock } = deps;
  // Each network's text when Claude's latest turn started, so its versions only replace the text
  // on screen when Calvin hasn't typed since.
  const starts = new Map<string, Record<string, string>>();
  const stateListeners = new Map<string, Set<(state: ShareState) => void>>();

  async function prompt(slug: string, thread: Thread, session: string | undefined) {
    const post = await publishedPost(library, slug);
    const text = (await library.read(slug))?.text ?? '';
    // Claude's versions Calvin has since rewritten: shown once each, so Claude asks about each once.
    const rewrites: Record<string, Version> = {};
    let state = fill(await share.load(slug));
    if (networks.some((n) => unnotedRewrite(state.networks[n.id]))) {
      state = await share.update(slug, (current) => {
        const next = fill(current);
        for (const n of networks) {
          const found = unnotedRewrite(next.networks[n.id]);
          if (!found) continue;
          rewrites[n.id] = found.version;
          next.networks[n.id] = markNoted(next.networks[n.id], found.index);
        }
        return { state: next, texts: texts(next, post) };
      });
    }
    starts.set(slug, Object.fromEntries(networks.map((n) => [n.id, state.networks[n.id].text])));
    return sharePrompt({
      first: !session,
      title: post.title,
      postPath: library.pathOf(slug),
      briefPath: `writing/briefs/${slug}.md`,
      figures: postFigures(text, library.pathOf(slug)),
      networks: networks.map((network) => {
        const resolved = resolvePost(network, state.networks[network.id], post);
        return { network, resolved, failures: checkPost(network, resolved.parts, undefined, resolved.image), rewrite: rewrites[network.id] };
      }),
      messages: thread.messages.map((m) => ({ author: m.author, text: m.text })),
    });
  }

  const conversation = createConversation({ library, threads, clock, agent: deps.agent, toolsUrl: deps.toolsUrl, turn: deps.turn, prompt });

  return {
    ask: conversation.ask,
    stop: conversation.stop,
    subscribe: conversation.subscribe,
    changed: conversation.changed,

    /** The share thread's messages, oldest first. */
    async list(slug: string): Promise<Thread[]> {
      await publishedPost(library, slug);
      return threads.load(slug);
    },

    /** Calvin's message, passed on to Claude. Resolves once it's saved; `replied` once Claude's turn ends. */
    async send(slug: string, text: string): Promise<{ threads: Thread[]; replied: Promise<void> }> {
      await publishedPost(library, slug);
      const next = comment(await threads.load(slug), { id: PAGE, text, at: clock.now().toISOString() });
      await threads.save(slug, next);
      return { threads: next, replied: conversation.ask(slug, PAGE) };
    },

    /** Each network's text when Claude's latest turn on the post started. */
    turnStart: (slug: string) => starts.get(slug),

    /** Tells the open share page that Claude changed the share state (eg wrote a version). */
    publishState(slug: string, state: ShareState) {
      for (const l of stateListeners.get(slug) ?? []) l(state);
    },

    subscribeState(slug: string, listener: (state: ShareState) => void): () => void {
      const set = stateListeners.get(slug) ?? new Set();
      stateListeners.set(slug, set.add(listener));
      return () => void set.delete(listener);
    },
  };
}

export type ShareConversation = ReturnType<typeof createShareConversation>;
