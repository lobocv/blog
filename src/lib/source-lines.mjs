// Dev-only, for the writing editor's preview: tags each rendered block with the line of the post
// file it starts on (data-line, front matter included), so the editor can keep the preview and
// the source on the same block. Only on when the editor starts `astro dev` with EDITOR_PREVIEW=1,
// so the built site never has these attributes.
//
// Figures are tagged with data-figure too, so Calvin can pick one in the preview to comment on.
// Markdown images are tagged directly. MDX components (eg <ContextStack />) and raw HTML images
// render as whatever they output, so each is wrapped in a div that carries the tags.
import { readFileSync } from 'node:fs';

const BLOCKS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre', 'table', 'tr', 'hr', 'figure', 'img', 'div', 'section']);

export function rehypeSourceLines() {
  return (tree, file) => {
    const offset = linesBefore(String(file.value ?? ''), file.path ? readFileSync(file.path, 'utf8') : '');
    const visit = (node) => {
      if (node.type === 'element' && BLOCKS.has(node.tagName) && node.position) {
        node.properties = { ...node.properties, dataLine: node.position.start.line + offset };
        // Astro hands a local image's properties to its Image component as they are, so camelCase
        // names would reach the page as written.
        if (node.tagName === 'img') {
          const { dataLine, ...rest } = node.properties;
          node.properties = { ...rest, 'data-line': dataLine, 'data-figure': 'image' };
        }
      }
      node.children?.forEach((child, i) => {
        const name = figureName(child);
        if (name && child.position) {
          const line = child.position.start.line + offset;
          node.children[i] = { type: 'element', tagName: 'div', properties: { dataLine: line, dataFigure: name }, children: [child] };
          child.children?.forEach(visit);
        } else visit(child);
      });
    };
    visit(tree);
  };
}

const HTML_FIGURE = /^\s*<(img|figure|picture|svg|video)\b/i;

/** What to call a component or raw HTML figure, or undefined when the node isn't one. */
function figureName(node) {
  if (node.type === 'mdxJsxFlowElement' && node.name) {
    if (/^[A-Z]/.test(node.name)) return node.name;
    if (HTML_FIGURE.test(`<${node.name}`)) return node.name === 'img' ? 'image' : node.name;
  }
  const raw = node.type === 'raw' && HTML_FIGURE.exec(node.value);
  if (raw) return raw[1].toLowerCase() === 'img' ? 'image' : raw[1].toLowerCase();
  return undefined;
}

// Astro hands the processor the body without its front matter, so positions start after it.
// Counts the file's lines above where the body begins.
export function linesBefore(body, file) {
  const at = body ? file.indexOf(body) : -1;
  return at > 0 ? file.slice(0, at).split('\n').length - 1 : 0;
}
