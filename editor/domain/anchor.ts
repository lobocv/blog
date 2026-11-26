// Pins a thread to the words it is about. The quote is the anchor; the line is only a hint for
// choosing between repeats of the same words, so threads survive edits above and around them.

/** `line` counts from 1, from the top of the file. */
export type Anchor = { quote: string; line: number };
export type Range = { from: number; to: number };

/** The 1-based line that character `pos` sits on. */
export function lineOf(text: string, pos: number): number {
  let line = 1;
  for (let i = text.indexOf('\n'); i !== -1 && i < pos; i = text.indexOf('\n', i + 1)) line++;
  return line;
}

/** An anchor for the selected text. An empty selection anchors to its whole line. */
export function anchorAt(text: string, { from, to }: Range): Anchor {
  if (from === to) {
    const start = text.lastIndexOf('\n', from - 1) + 1;
    const end = text.indexOf('\n', from);
    [from, to] = [start, end === -1 ? text.length : end];
  }
  return { quote: text.slice(from, to), line: lineOf(text, from) };
}

/** Where the quote is now: the copy nearest the line hint. Undefined once the words are gone. */
export function locate(text: string, anchor: Anchor): Range | undefined {
  if (!anchor.quote.trim()) return undefined;
  let best: Range | undefined;
  let bestDistance = Infinity;
  for (let at = text.indexOf(anchor.quote); at !== -1; at = text.indexOf(anchor.quote, at + 1)) {
    const distance = Math.abs(lineOf(text, at) - anchor.line);
    if (distance < bestDistance) [best, bestDistance] = [{ from: at, to: at + anchor.quote.length }, distance];
  }
  return best;
}

/**
 * An anchor for text selected in the preview, which only knows the line its block starts on.
 * Rendered text often matches the source (plain words), so use it when it's found near that
 * line. Otherwise (eg the selection crosses **bold** or a link) anchor to the block's first line.
 */
export function anchorNear(text: string, selected: string, line: number): Anchor | undefined {
  const quote = selected.trim();
  const found = quote && !quote.includes('\n') ? locate(text, { quote, line }) : undefined;
  if (found && Math.abs(lineOf(text, found.from) - line) <= NEAR) return { quote, line: lineOf(text, found.from) };
  const lines = text.split('\n');
  for (let i = line - 1; i < lines.length; i++) {
    if (lines[i]?.trim()) return { quote: lines[i], line: i + 1 };
  }
  return undefined;
}

// A block in the preview spans at most this many source lines in practice (eg a long list).
const NEAR = 40;
