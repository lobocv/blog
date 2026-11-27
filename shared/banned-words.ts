// The banned phrases in banned-words.json, matched the way scripts/lint_post.py matches them.
import list from './banned-words.json' with { type: 'json' };

/** One banned phrase found in the text, as written there (with straight apostrophes). */
export type BannedWord = { from: number; to: number; word: string };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordChar = '[\\p{L}\\p{N}_]';
const pattern = new RegExp(
  `(?<!${wordChar})(?:${list.phrases.map((p) => escape(p.text) + ('prefix' in p && p.prefix ? `${wordChar}*` : '')).join('|')})(?!${wordChar})`,
  'giu',
);

/** Curly apostrophes read as straight ones. Same length, so offsets still point into the original. */
export const straighten = (text: string) => text.replace(/[‘’]/g, "'");

export function bannedWords(text: string): BannedWord[] {
  return [...straighten(text).matchAll(pattern)].map((m) => ({ from: m.index, to: m.index + m[0].length, word: m[0] }));
}
