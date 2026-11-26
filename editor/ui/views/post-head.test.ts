import { EditorSelection, EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { bodyStart, headEdit, postHead } from './post-head.ts';

const text = '---\ntitle: "T"\ndraft: true\n---\nBody line.\n';
const start = text.indexOf('Body');
const state = (doc = text) => EditorState.create({ doc, extensions: postHead });

describe('post head', () => {
  it('finds where the body starts, or 0 without front matter the form can edit', () => {
    expect(bodyStart(state())).toBe(start);
    expect(bodyStart(state('Just words.'))).toBe(0);
    expect(bodyStart(state('hh---\ntitle: T\n---\nBody'))).toBe(0);
  });

  it('lets typing change the body, even at its very start', () => {
    const s = state().update({ changes: { from: start, insert: 'New. ' } }).state;
    expect(s.doc.toString()).toBe(text.replace('Body', 'New. Body'));
  });

  it("doesn't let typing reach the front matter or the line break after it", () => {
    expect(state().update({ changes: { from: 5, to: 10, insert: 'x' } }).state.doc.toString()).toBe(text);
    expect(state().update({ changes: { from: start - 1, to: start } }).state.doc.toString()).toBe(text);
    // Select all and delete: the body goes, the front matter stays.
    expect(state().update({ changes: { from: 0, to: text.length } }).state.doc.toString()).toBe(text.slice(0, start));
  });

  it('lets the form, outside edits and undo change it', () => {
    const s = state().update({ changes: { from: 12, to: 13, insert: 'U' }, annotations: headEdit.of(true) }).state;
    expect(s.doc.toString()).toBe(text.replace('"T"', '"U"'));
  });

  it('keeps the cursor in the body', () => {
    expect(state().update({ selection: EditorSelection.cursor(0) }).state.selection.main.head).toBe(start);
  });

  it('shows everything when the front matter is broken, so it can be fixed by hand', () => {
    const broken = 'hh---\ntitle: T\n---\nBody';
    expect(state(broken).update({ changes: { from: 0, to: 2 } }).state.doc.toString()).toBe('---\ntitle: T\n---\nBody');
  });

  it('hides MDX imports after the front matter too, with the blank lines between them', () => {
    const mdx = "---\ntitle: T\n---\n\nimport A from './A.astro';\nimport {\n  B,\n} from './B';\n\nBody\n";
    // Through the blank line after the last import, so nothing typed can join onto it.
    expect(bodyStart(state(mdx))).toBe(mdx.indexOf('Body'));
    expect(bodyStart(state("import A from './A.astro';\nBody"))).toBe("import A from './A.astro';\n".length);
    // An import further down is the body's.
    const later = '---\ntitle: T\n---\nIntro.\nimport A from "a";\n';
    expect(bodyStart(state(later))).toBe(later.indexOf('Intro'));
  });
});
