// Calvin's drafting notes for Claude (the pattern is in shared/notes.ts).
// In `astro dev` notes show as highlighted spans; in a build they're dropped from drafts and fail the
// build in a published post, so one can never ship. See "Notes in the post" in docs/writing.md.

import { NOTE } from '../../shared/notes.ts';

export { NOTE };

const SKIP = new Set(['code', 'pre', 'script', 'style']);

// Split one text value into text and note nodes
function split(value, show) {
  const out = [];
  let last = 0;
  for (const m of value.matchAll(NOTE)) {
    if (m.index > last) out.push({ type: 'text', value: value.slice(last, m.index) });
    if (show) {
      const reply = /^claude:/i.test(m[1]);
      out.push({ type: 'element', tagName: 'mark', properties: { className: ['post-note', ...(reply ? ['reply'] : [])], title: reply ? 'Reply from Claude' : 'Note for Claude' }, children: [{ type: 'text', value: m[1] }] });
    }
    last = m.index + m[0].length;
    // a dropped inline note shouldn't leave a double space behind
    if (!show && /\s/.test(value[m.index - 1] ?? '') && /[ \t]/.test(value[last] ?? '')) last++;
  }
  if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
  return out;
}

// Every note in a tree, outside code
export function findNotes(tree) {
  const found = [];
  const walk = n => {
    if (n.type === 'element' && SKIP.has(n.tagName)) return;
    if (n.type === 'text') for (const m of n.value.matchAll(NOTE)) found.push(m[1]);
    n.children?.forEach(walk);
  };
  walk(tree);
  return found;
}

/** @param {{ dev: boolean }} opts */
export function rehypeNotes({ dev }) {
  return (tree, file) => {
    const notes = findNotes(tree);
    if (!notes.length) return;
    const draft = file?.data?.astro?.frontmatter?.draft === true;
    if (!dev && !draft) {
      throw new Error(`${file?.path ?? 'A published post'} still has ${notes.length} @@ note(s), eg "${notes[0]}". Resolve them (/notes) before publishing.`);
    }
    const walk = n => {
      if (!n.children || (n.type === 'element' && SKIP.has(n.tagName))) return;
      n.children = n.children.flatMap(c => (c.type === 'text' && c.value.includes('@@') ? split(c.value, dev) : [c]));
      n.children.forEach(walk);
    };
    walk(tree);
  };
}
