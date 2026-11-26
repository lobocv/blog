// Comment threads on a post. Pure functions that return new arrays, so the UI and the server
// share them and tests need no setup.
import { NOTE } from '../../shared/notes.ts';
import { type Anchor, lineOf, locate } from './anchor.ts';

export type Author = 'calvin' | 'claude';
export type Message = { author: Author; text: string; at: string };

/**
 * A thread pinned to quoted text, or the page thread (no anchor) for comments on the whole post.
 * `lost` means the quoted words are gone; the thread then shows with the page thread.
 */
export type Thread = { id: string; anchor?: Anchor; resolved: boolean; lost?: boolean; messages: Message[] };

/** An `@@` note in the post, shown as a thread. Notes live in the text, so they can't be replied to here. */
export type Note = { id: string; anchor: Anchor; message: Message };

export const PAGE = 'page';

/** Starts a thread on `anchor`, or adds to the page thread when there is none. */
export function comment(threads: Thread[], c: { id: string; anchor?: Anchor; text: string; at: string }): Thread[] {
  const message: Message = { author: 'calvin', text: c.text, at: c.at };
  if (!c.anchor) {
    const page = threads.find((t) => t.id === PAGE);
    if (page) return reply(threads, PAGE, message)!;
    return [...threads, { id: PAGE, resolved: false, messages: [message] }];
  }
  return [...threads, { id: c.id, anchor: c.anchor, resolved: false, messages: [message] }];
}

/** Adds a message, reopening a resolved thread. Undefined when there is no such thread. */
export function reply(threads: Thread[], id: string, message: Message): Thread[] | undefined {
  if (!threads.some((t) => t.id === id)) return undefined;
  return threads.map((t) => (t.id === id ? { ...t, resolved: false, messages: [...t.messages, message] } : t));
}

/** Undefined when there is no such thread. */
export function resolve(threads: Thread[], id: string): Thread[] | undefined {
  if (!threads.some((t) => t.id === id)) return undefined;
  return threads.map((t) => (t.id === id ? { ...t, resolved: true } : t));
}

/** Updates each anchor's line hint after the text changed, and marks threads whose words are gone. */
export function reanchor(threads: Thread[], text: string): Thread[] {
  return threads.map((t) => {
    if (!t.anchor) return t;
    const at = locate(text, t.anchor);
    if (!at) return { ...t, lost: true };
    const { lost: _, ...rest } = t;
    return { ...rest, anchor: { quote: t.anchor.quote, line: lineOf(text, at.from) } };
  });
}

/** The `@@` notes in the post, in order. */
export function notes(text: string): Note[] {
  const seen = new Map<string, number>();
  return [...text.matchAll(NOTE)].map((m) => {
    const n = (seen.get(m[0]) ?? 0) + 1;
    seen.set(m[0], n);
    const reply = /^claude:\s*/i.exec(m[1]);
    return {
      id: `note:${m[0]}#${n}`,
      anchor: { quote: m[0], line: lineOf(text, m.index) },
      message: { author: reply ? 'claude' : 'calvin', text: reply ? m[1].slice(reply[0].length) : m[1], at: '' },
    };
  });
}

/** The status line's counts. The page thread counts once it has messages; notes always count as open. */
export function counts(threads: Thread[], noteCount = 0): { open: number; resolved: number } {
  const resolved = threads.filter((t) => t.resolved).length;
  return { open: threads.length - resolved + noteCount, resolved };
}
