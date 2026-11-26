// Word count and reading time for a post's Markdown body (no front matter).
// The site's post pages and the editor's status line both use these, so the
// two always agree.

const WORDS_PER_MINUTE = 213; // Hugo's reading-time rate

export function countWords(markdown: string): number {
  // Like Hugo, code counts as reading; fence markers, tags and punctuation-only tokens don't.
  // MDX import lines and {/* comments */} aren't reading either.
  const text = markdown
    .replace(/^```.*$/gm, ' ')
    .replace(/^import .*$/gm, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function readingMinutes(markdown: string): number {
  return Math.max(1, Math.ceil(countWords(markdown) / WORDS_PER_MINUTE));
}
