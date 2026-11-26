// Dev-only, for the writing editor's preview: tags each rendered block with the line of the post
// file it starts on (data-line, front matter included), so the editor can keep the preview and
// the source on the same block. Only on when the editor starts `astro dev` with EDITOR_PREVIEW=1,
// so the built site never has these attributes.
import { readFileSync } from 'node:fs';

const BLOCKS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre', 'table', 'tr', 'hr', 'figure', 'img', 'div', 'section']);

export function rehypeSourceLines() {
  return (tree, file) => {
    const offset = linesBefore(String(file.value ?? ''), file.path ? readFileSync(file.path, 'utf8') : '');
    const visit = (node) => {
      if (node.type === 'element' && BLOCKS.has(node.tagName) && node.position) {
        node.properties = { ...node.properties, dataLine: node.position.start.line + offset };
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

// Astro hands the processor the body without its front matter, so positions start after it.
// Counts the file's lines above where the body begins.
export function linesBefore(body, file) {
  const at = body ? file.indexOf(body) : -1;
  return at > 0 ? file.slice(0, at).split('\n').length - 1 : 0;
}
