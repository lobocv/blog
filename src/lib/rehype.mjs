// Rehype plugins for post bodies.

const isEl = (n, tag) => n?.type === 'element' && (!tag || n.tagName === tag);
const blank = n => n.type === 'text' && !n.value.trim();
const kids = n => n.children.filter(c => !blank(c));
const text = n => (n.type === 'text' ? n.value : (n.children ?? []).map(text).join(''));

// A caption paragraph: text matching re, either all in bold (eg **Figure 1: ...**) or plain
function captionMatch(node, re) {
  if (!isEl(node, 'p')) return null;
  const k = kids(node);
  const src = k.length === 1 && isEl(k[0], 'strong') ? k[0] : node;
  const m = text(src).trim().match(re);
  return m ? { strong: src, m } : null;
}

// An image on its own, either bare (raw HTML <img>) or as the only thing in a paragraph
function imageOf(node) {
  if (isEl(node, 'img')) return node;
  // An <img> tag on its own line in the Markdown arrives as raw HTML
  if (node.type === 'raw' && /^\s*<img\b[^>]*>\s*$/i.test(node.value)) return node;
  if (isEl(node, 'p')) { const k = kids(node); if (k.length === 1 && isEl(k[0], 'img')) return k[0]; }
  return null;
}

// The strong's content with its "Figure 1:" prefix pulled out into a label span
function figcaption(strong, label) {
  const children = structuredClone(strong.children);
  const first = children[0];
  if (first?.type === 'text') first.value = first.value.slice(first.value.indexOf(label) + label.length).replace(/^\s+/, ' ');
  return { type: 'element', tagName: 'figcaption', properties: {}, children: [
    { type: 'element', tagName: 'span', properties: { className: ['label'] }, children: [{ type: 'text', value: label }] }, ...children] };
}

const siblingIndex = (children, i, step) => { let j = i + step; while (children[j] && blank(children[j])) j += step; return j; };

const NUMBERED = /^((?:Figure|Table) \d+:)/;
const el = (tagName, className, children) => ({ type: 'element', tagName, properties: className ? { className: [className] } : {}, children });

// What a numbered caption can sit next to: a table, an image, or a code block
function captionable(node) {
  if (isEl(node, 'table')) return { node, cls: 'table', wrap: n => el('div', 'table-scroll', [n]) };
  if (isEl(node, 'pre') || (node.type === 'raw' && /^\s*<pre\b/i.test(node.value))) return { node, cls: 'code-figure', wrap: n => n };
  const img = imageOf(node);
  return img ? { node: img, cls: null, wrap: n => n } : null;
}

/** Turns the "Figure N:" / "Table N:" caption convention into <figure> and <figcaption>.
 *  A caption below the block wins; otherwise one directly above it is used, placed on top.
 *  A bold "Table: name" line directly above a table becomes the table's <caption>. */
export function rehypeCaptions() {
  const walk = parent => {
    const c = parent.children;
    for (let i = 0; i < c.length; i++) {
      const target = captionable(c[i]);
      if (!target) {
        if (isEl(c[i]) && c[i].children?.length && !['pre', 'code', 'figure', 'table'].includes(c[i].tagName)) walk(c[i]);
        continue;
      }
      let start = i, end = i, top = null, bottom = null;
      const prev = siblingIndex(c, i, -1), next = siblingIndex(c, i, 1);
      const title = isEl(target.node, 'table') && prev >= 0 && captionMatch(c[prev], /^Table:\s*(.+)$/s);
      if (title) { target.node.children.unshift(el('caption', null, [{ type: 'text', value: title.m[1].trim() }])); start = prev; }
      const below = captionMatch(c[next], NUMBERED);
      const above = !below && !title && prev >= 0 && captionMatch(c[prev], NUMBERED);
      if (below) { bottom = figcaption(below.strong, below.m[1]); end = next; }
      else if (above) { top = figcaption(above.strong, above.m[1]); start = prev; }
      if (!top && !bottom && !isEl(target.node, 'table')) continue; // a plain image or code block stays as it is
      const fig = el('figure', target.cls, [top, target.wrap(target.node), bottom].filter(Boolean));
      c.splice(start, end - start + 1, fig);
      i = start;
    }
  };
  return tree => walk(tree);
}

/** Adds an empty "#" link (drawn with CSS) to h2 and h3. Runs after heading ids are assigned. */
export function rehypeHeadingAnchors() {
  const walk = parent => {
    for (const node of parent.children ?? []) {
      if (isEl(node, 'h2') || isEl(node, 'h3')) {
        if (node.properties?.id) node.children.push({ type: 'element', tagName: 'a', properties: { className: ['anchor'], href: `#${node.properties.id}`, ariaLabel: 'Link to this section' }, children: [] });
      } else if (isEl(node)) walk(node);
    }
  };
  return tree => walk(tree);
}
