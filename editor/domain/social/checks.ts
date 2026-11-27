// The checks that need no judgment, run as Calvin types. Each failure points into his text.
import { bannedWords } from '../../../shared/banned-words.ts';
import type { Failure, Network, Parts } from './network.ts';

/**
 * Where the phone preview found the fold: the first character the feed hides, in the assembled
 * text it measured. A measurement for different text is stale and ignored.
 */
export type MeasuredFold = { text: string; offset: number };

/** The end of the first paragraph of `text` (the hook), skipping leading blank lines. */
export function hookEnd(text: string): number {
  const start = text.search(/\S/);
  if (start < 0) return 0;
  const gap = /\r?\n[ \t]*\r?\n/g;
  gap.lastIndex = start;
  const m = gap.exec(text);
  return (m ? m.index : text.trimEnd().length);
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

export function checkPost(network: Network, parts: Parts, fold?: MeasuredFold): Failure[] {
  const assembled = network.assemble(parts);
  const out: Failure[] = [];

  const length = network.count(assembled.text);
  if (length > network.limit) {
    out.push({ check: 'length', message: `${length.toLocaleString('en')} characters, over the ${network.limit.toLocaleString('en')} limit`, ranges: [] });
  }

  if (network.fold.kind === 'lines' && fold && fold.text === assembled.text) {
    const end = hookEnd(parts.text);
    const foldInBody = fold.offset - assembled.shift;
    if (end > foldInBody) {
      out.push({ check: 'fold', message: 'The first paragraph runs past the fold', ranges: [{ from: Math.max(0, foldInBody), to: end }] });
    }
  }

  const inline = [...parts.text.matchAll(/(?<![\p{L}\p{N}_])#[\p{L}\p{N}_]+/gu)].length;
  const tags = parts.hashtags.length + inline;
  const { min, max } = network.hashtags;
  if (tags < min || tags > max) {
    out.push({ check: 'hashtags', message: `${plural(tags, 'hashtag')}; ${min} to ${max} works best`, ranges: [] });
  }

  const banned = bannedWords(parts.text);
  if (banned.length) {
    out.push({ check: 'banned', message: `Reads as AI-written: ${banned.map((b) => `"${b.word}"`).join(', ')}`, ranges: banned.map(({ from, to }) => ({ from, to })) });
  }

  const dashes = [...parts.text.matchAll(/—/g)].map((m) => ({ from: m.index, to: m.index + 1 }));
  if (dashes.length) out.push({ check: 'em-dash', message: plural(dashes.length, 'em-dash'), ranges: dashes });

  for (const check of network.checks ?? []) out.push(...check(parts, assembled));
  return out;
}
