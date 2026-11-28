// What Claude is told on the share page, where it writes social posts for a published post.
// Unlike blog posts, these are Claude's to write; Calvin edits and posts them.
import type { FigureOption } from './figures.ts';
import { figureKey } from './figures.ts';
import type { Failure, Network } from './network.ts';
import type { Resolved } from './resolve.ts';
import type { Version } from './social-post.ts';

/** Appended to Claude's system prompt for every share page turn. */
export const SHARE_SYSTEM_PROMPT = [
  "You are on the share page of Calvin's writing editor, writing social posts that share one of his published blog posts.",
  'These posts are yours to write: save each one with the write_social_post tool, which puts it in the text box',
  "(or, if Calvin is typing, in his Versions menu). Calvin edits it and posts it himself; you never post.",
  "Write in Calvin's voice, following docs/voice.md. State only what the post, its brief or Calvin says:",
  'no invented numbers, dates, durations or experiences. If a claim you want to make isn\'t there, leave it out,',
  'or keep it and list it in claims_to_check so Calvin sees it. Never pitch a product the post mentions.',
  'No em-dashes, and none of the phrases in shared/banned-words.json.',
  'Hashtags go in the tool\'s hashtags field without the #, within the network\'s range; the editor adds them and',
  'the link to the text, so leave both out of the text. When the post carries an image, pick the figure that best',
  'shows the post\'s argument by its key, and write alt text that says what it shows.',
  'To draft, write from the post. To critique a draft of Calvin\'s, say in a few lines what to change (length',
  'against the limit, phrases that read as AI-written, whether the first line gives a reason to click), then save',
  'the rewrite, keeping his phrasing wherever it already works.',
  'Your reply goes in the share page\'s thread: short and plain, no preamble, and don\'t repeat the post text,',
  'since it shows in the text box.',
  'When a message shows that Calvin rewrote part of your text, ask him once, in a sentence, whether the change is a',
  'voice rule worth adding to docs/voice.md. Only if he says yes, add it there in the file\'s style. Edit no other file.',
].join(' ');

/** A network's rules, as Claude needs them to write for it. */
export function describeNetwork(n: Network): string {
  const fold = n.fold.kind === 'lines' ? ` The feed cuts posts after about ${n.fold.lines} lines on a ${n.fold.viewport}.` : '';
  const media = n.media.length > 1 ? ` It can carry: ${n.media.join(', ')}.` : '';
  return `${n.label} (network "${n.id}"): at most ${n.limit.toLocaleString('en')} characters, ${n.hashtags.min} to ${n.hashtags.max} hashtags.${fold}${media} ${n.guide}`.trim();
}

/** One network's post as it stands. `rewrite` is Claude's last version when Calvin has since rewritten it. */
export type NetworkNow = { network: Network; resolved: Resolved; failures: Failure[]; rewrite?: Version };

export type ShareTurn = {
  /** The first turn of a session, which says what to read. */
  first: boolean;
  title: string;
  postPath: string;
  briefPath: string;
  figures: FigureOption[];
  networks: NetworkNow[];
  /** The share thread so far, oldest first. */
  messages: { author: 'calvin' | 'claude'; text: string }[];
};

const quoted = (text: string) => (text.trim() ? `"""\n${text.trim()}\n"""` : '(empty)');

function now({ network, resolved, failures, rewrite }: NetworkNow, figures: FigureOption[]): string {
  const lines = [`## ${network.label}`, `Text on screen:\n${quoted(resolved.parts.text)}`];
  lines.push(`Hashtags: ${resolved.parts.hashtags.map((t) => `#${t}`).join(' ') || '(none)'}`);
  if (resolved.image) {
    const label = figures.find((f) => f.key === figureKey(resolved.image!.figure))?.label ?? figureKey(resolved.image.figure);
    lines.push(`Image: ${label} (${resolved.image.theme}), alt text ${resolved.image.alt ? `"${resolved.image.alt}"` : '(none)'}`);
  } else lines.push(`Media: ${resolved.media}`);
  if (failures.length) lines.push(`Failing checks: ${failures.map((f) => f.message).join('; ')}`);
  if (rewrite) lines.push(`Calvin rewrote your last version. Yours was:\n${quoted(rewrite.text)}`);
  return lines.join('\n');
}

/** The message for one share page turn. */
export function sharePrompt(t: ShareTurn): string {
  const parts: string[] = [];
  if (t.first) {
    parts.push(
      `This is the share page for "${t.title}" (${t.postPath}). Before writing, read the post, its brief (${t.briefPath}, if it exists) and docs/voice.md.`,
      `Networks:\n${t.networks.map((n) => `- ${describeNetwork(n.network)}`).join('\n')}`,
      `Figures an image can show (pass the key):\n${t.figures.map((f) => `- ${f.key}: ${f.label}`).join('\n')}`,
    );
  }
  parts.push(`Where things stand:\n\n${t.networks.map((n) => now(n, t.figures)).join('\n\n')}`);
  parts.push(t.messages.map((m) => `${m.author === 'claude' ? 'You' : 'Calvin'}: ${m.text}`).join('\n\n'));
  return parts.join('\n\n');
}

/** What D sends: a draft when the text is empty, otherwise a critique and rewrite of Calvin's. */
export const draftRequest = (network: Network, text: string) =>
  text.trim() ? `Critique my ${network.label} draft, then rewrite it.` : `Draft the ${network.label} post.`;
