// What Claude is told for each turn. It keeps the post in mind across turns (one session per
// post), but every message still names the thread and quotes its words, since lines move.
import { type Figure, figureIn } from './figure.ts';
import { PAGE, type Thread } from './thread.ts';

/** Appended to Claude's system prompt for every turn in the editor. */
export const EDITOR_SYSTEM_PROMPT = [
  "You are replying in comment threads in Calvin's writing editor, on one of his blog posts.",
  'Whatever you write goes straight into the thread as your reply, so write only the reply:',
  'short and plain, with no preamble. You cannot edit the post. To propose a change, call the',
  "suggest_edit tool with the thread's id, and keep the reply to a line or two since the",
  'suggestion shows in the thread. Calvin writes the prose; follow docs/writing.md.',
  'When a skill (eg critique) says to edit the post, call suggest_edit for each change instead,',
  'with mechanical: true for mechanical fixes (typos, spacing, punctuation, capitalisation).',
  'While working through a checklist, call review_progress as each item is done.',
  'Figures are different: their components (in src/components/) are code, not prose, so edit',
  'them directly when Calvin asks for a change, following docs/figures.md. The preview reloads',
  'when you save. Read an image file to see it.',
].join(' ');

const about = (f: Figure | undefined) =>
  !f
    ? 'these words'
    : f.kind === 'image'
      ? `the image ${f.src}`
      : `the figure ${f.name}${f.source ? ` (its code is in ${f.source})` : ''}`;

/**
 * The message for one turn: where the thread is, what it quotes, and the conversation so far.
 * `postText` lets it say which figure a thread is on.
 */
export function threadPrompt(path: string, thread: Thread, postText = ''): string {
  const quote = thread.anchor?.quote.replace(/\n/g, '\n> ');
  const where =
    thread.id === PAGE
      ? `Calvin wrote in the page thread (comments on the whole post) for ${path}.`
      : thread.anchor
        ? `Calvin wrote in thread ${thread.id} on ${path}, about ${about(figureIn(thread.anchor.quote, postText, path))} near line ${thread.anchor.line}:\n> ${quote}`
        : `Calvin wrote in thread ${thread.id} on ${path}.`;
  const lost = thread.lost ? '\nThe quoted words are no longer in the post.' : '';
  const talk = thread.messages.map((m) => `${m.author === 'claude' ? 'You' : 'Calvin'}: ${m.text}`).join('\n\n');
  // A message like "/critique line" asks for a skill, as it would in a terminal.
  const latest = thread.messages.at(-1);
  const command = latest?.author === 'calvin' ? /^\/([\w-]+)\s*(.*)$/s.exec(latest.text.trim()) : null;
  const skill = command ? `\n\nCalvin's last message is a command: run the \`${command[1]}\` skill${command[2] ? ` with "${command[2]}"` : ''} on this post.` : '';
  return `${where}${lost}\n\nRead the post if you need more context. Lines may have moved since.\n\n${talk}${skill}`;
}
