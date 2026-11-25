import { describe, expect, it } from 'vitest';
import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import { rehypeNotes } from './notes.mjs';

const run = (html: string, dev: boolean, draft = true) => {
  const tree = fromHtml(html, { fragment: true });
  rehypeNotes({ dev })(tree as any, { path: 'post.mdx', data: { astro: { frontmatter: { draft } } } });
  return toHtml(tree);
};

describe('rehypeNotes', () => {
  it('shows a note that runs to the end of the line in dev', () => {
    expect(run('<p>@@ should a figure go here?</p>', true))
      .toBe('<p><mark class="post-note" title="Note for Claude">should a figure go here?</mark></p>');
  });

  it('ends an inline note at the closing marker and keeps the rest of the sentence', () => {
    expect(run('<p>A @@ think of a better word @@ word here.</p>', true))
      .toBe('<p>A <mark class="post-note" title="Note for Claude">think of a better word</mark> word here.</p>');
  });

  it('ends an unclosed note at the line break', () => {
    expect(run('<p>First line @@ not a fan\nsecond line</p>', true))
      .toBe('<p>First line <mark class="post-note" title="Note for Claude">not a fan</mark>\nsecond line</p>');
  });

  it('marks replies from Claude', () => {
    expect(run('<p>@@ claude: yes, after this paragraph</p>', true)).toContain('class="post-note reply"');
  });

  it('leaves code alone', () => {
    expect(run('<p><code>a @@ b</code></p>', true)).toBe('<p><code>a @@ b</code></p>');
  });

  it('drops notes from drafts in a build', () => {
    expect(run('<p>Text @@ note @@ more</p>', false)).toBe('<p>Text more</p>');
  });

  it('fails the build for a published post with a note', () => {
    expect(() => run('<p>Text @@ fix me</p>', false, false)).toThrow(/still has 1 @@ note/);
  });
});
