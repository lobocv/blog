// Claude's proposed edits. Claude never changes the post: a suggestion sits in its thread until
// Calvin accepts it (the editor applies it like his own typing), tweaks it, or rejects it.
import { lineOf, locate, type Range } from './anchor.ts';
import { reply, type Thread } from './thread.ts';

/** Replace `find` (as the post has it, near `line`) with `replace`. */
export type Suggestion = {
  id: string;
  find: string;
  replace: string;
  line: number;
  status: 'open' | 'accepted' | 'rejected';
};

/** Where the suggestion applies now. Undefined once the words it replaces have changed. */
export function target(text: string, s: Pick<Suggestion, 'find' | 'line'>): Range | undefined {
  return locate(text, { quote: s.find, line: s.line });
}

/**
 * Adds Claude's suggestion to a thread, as a message whose text is the reason. Fails with a
 * message Claude can act on when `find` isn't in the post.
 */
export function suggest(
  threads: Thread[],
  text: string,
  s: { threadId: string; id: string; find: string; replace: string; reason: string; at: string },
): { threads: Thread[] } | { error: string } {
  const thread = threads.find((t) => t.id === s.threadId);
  if (!thread) return { error: `There is no thread "${s.threadId}".` };
  if (!s.find) return { error: '`find` is empty. Copy the exact words to replace from the post.' };
  if (s.find === s.replace) return { error: '`replace` is the same as `find`.' };
  const near = thread.anchor?.line ?? 1;
  const at = locate(text, { quote: s.find, line: near });
  if (!at) return { error: '`find` is not in the post as it is now. Read the post again and copy the exact words.' };
  const suggestion: Suggestion = { id: s.id, find: s.find, replace: s.replace, line: lineOf(text, at.from), status: 'open' };
  const next = reply(threads, s.threadId, { author: 'claude', text: s.reason, at: s.at, suggestion });
  return { threads: next! };
}

/**
 * Marks a suggestion accepted (with Calvin's tweak, if any) or rejected. An accepted edit often
 * rewrites the words its thread quotes, so the quote follows the edit and the thread keeps its
 * place. Undefined when there is no such suggestion.
 */
export function settle(threads: Thread[], id: string, status: 'accepted' | 'rejected', replace?: string): Thread[] | undefined {
  let found = false;
  const next = threads.map((t) => {
    const s = t.messages.find((m) => m.suggestion?.id === id)?.suggestion;
    if (!s) return t;
    found = true;
    const settled = { ...s, status, replace: replace ?? s.replace };
    const messages = t.messages.map((m) => (m.suggestion?.id === id ? { ...m, suggestion: settled } : m));
    if (status !== 'accepted' || !t.anchor) return { ...t, messages };
    const { lost: _, ...rest } = t;
    return { ...rest, messages, anchor: { ...t.anchor, quote: followEdit(t.anchor.quote, s.find, settled.replace) } };
  });
  return found ? next : undefined;
}

// The quote after `find` became `replace`: edited inside it, or replaced wholesale when the quote
// was part of the edited words.
function followEdit(quote: string, find: string, replace: string): string {
  if (quote.includes(find)) return quote.replace(find, replace);
  if (find.includes(quote)) return replace;
  return quote;
}

/** The thread's latest suggestion still waiting on Calvin. */
export function openSuggestion(thread: Pick<Thread, 'messages'>): Suggestion | undefined {
  return thread.messages.findLast((m) => m.suggestion?.status === 'open')?.suggestion;
}
