// What Claude is told for each turn. It keeps the post in mind across turns (one session per
// post), but every message still names the thread and quotes its words, since lines move.
import { PAGE, type Thread } from './thread.ts';

/** Appended to Claude's system prompt for every turn in the editor. */
export const EDITOR_SYSTEM_PROMPT = [
  "You are replying in comment threads in Calvin's writing editor, on one of his blog posts.",
  'Whatever you write goes straight into the thread as your reply, so write only the reply:',
  'short and plain, with no preamble. You cannot edit the post. When you suggest wording,',
  'quote it in the reply. Calvin writes the prose; follow docs/writing.md.',
].join(' ');

/** The message for one turn: where the thread is, what it quotes, and the conversation so far. */
export function threadPrompt(path: string, thread: Thread): string {
  const where =
    thread.id === PAGE
      ? `Calvin wrote in the page thread (comments on the whole post) for ${path}.`
      : thread.anchor
        ? `Calvin wrote in thread ${thread.id} on ${path}, about these words near line ${thread.anchor.line}:\n> ${thread.anchor.quote.replace(/\n/g, '\n> ')}`
        : `Calvin wrote in thread ${thread.id} on ${path}.`;
  const lost = thread.lost ? '\nThe quoted words are no longer in the post.' : '';
  const talk = thread.messages.map((m) => `${m.author === 'claude' ? 'You' : 'Calvin'}: ${m.text}`).join('\n\n');
  return `${where}${lost}\n\nRead the post if you need more context. Lines may have moved since.\n\n${talk}`;
}
