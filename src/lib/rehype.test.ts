import { describe, expect, it } from 'vitest';
import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import { rehypeCaptions, rehypeHeadingAnchors } from './rehype.mjs';

const run = (plugin: () => (tree: any) => void, html: string) => {
  const tree = fromHtml(html, { fragment: true });
  plugin()(tree);
  return toHtml(tree).replace(/\n/g, '');
};

describe('rehypeCaptions', () => {
  it('wraps an image and the bold Figure line after it in a figure', () => {
    expect(run(rehypeCaptions, '<img src="a.svg" alt="A">\n<p><strong>Figure 1: The flow.</strong></p>'))
      .toBe('<figure><img src="a.svg" alt="A"><figcaption><span class="label">Figure 1:</span> The flow.</figcaption></figure>');
  });

  it('handles an image written as raw HTML in the Markdown', () => {
    const tree: any = { type: 'root', children: [
      { type: 'raw', value: '<img alt="A" src="a.svg"/>' }, { type: 'text', value: '\n' },
      fromHtml('<p><strong>Figure 1: Flow</strong></p>', { fragment: true }).children[0]] };
    rehypeCaptions()(tree);
    expect(toHtml(tree, { allowDangerousHtml: true })).toBe('<figure><img alt="A" src="a.svg"/><figcaption><span class="label">Figure 1:</span> Flow</figcaption></figure>');
  });

  it('handles an image inside its own paragraph', () => {
    expect(run(rehypeCaptions, '<p><img src="a.png" alt="A"></p><p><strong>Figure 2: B</strong></p>'))
      .toBe('<figure><img src="a.png" alt="A"><figcaption><span class="label">Figure 2:</span> B</figcaption></figure>');
  });

  it('turns a Table name line into a caption and the Table N line into a figcaption', () => {
    const out = run(rehypeCaptions, '<p><strong>Table: slot_counters</strong></p><table><tr><td>1</td></tr></table><p><strong>Table 1: Counts.</strong></p>');
    expect(out).toBe('<figure class="table"><div class="table-scroll"><table><caption>slot_counters</caption><tbody><tr><td>1</td></tr></tbody></table></div><figcaption><span class="label">Table 1:</span> Counts.</figcaption></figure>');
  });

  it('uses a Table N line written above the table as a caption on top', () => {
    expect(run(rehypeCaptions, '<p><strong>Table 1: Codes. <a href="r">[Reference]</a></strong></p><table><tr><td>1</td></tr></table>'))
      .toBe('<figure class="table"><figcaption><span class="label">Table 1:</span> Codes. <a href="r">[Reference]</a></figcaption><div class="table-scroll"><table><tbody><tr><td>1</td></tr></tbody></table></div></figure>');
  });

  it('accepts a caption that is not bold', () => {
    expect(run(rehypeCaptions, '<table><tr><td>1</td></tr></table><p>Table 1: Join of <code>a</code></p>'))
      .toBe('<figure class="table"><div class="table-scroll"><table><tbody><tr><td>1</td></tr></tbody></table></div><figcaption><span class="label">Table 1:</span> Join of <code>a</code></figcaption></figure>');
  });

  it('captions a code block with a Figure line above it', () => {
    expect(run(rehypeCaptions, '<p><strong>Figure 1: A log.</strong></p><pre><code>{}</code></pre>'))
      .toBe('<figure class="code-figure"><figcaption><span class="label">Figure 1:</span> A log.</figcaption><pre><code>{}</code></pre></figure>');
  });

  it('wraps a bare table so it scrolls on phones', () => {
    expect(run(rehypeCaptions, '<table><tr><td>1</td></tr></table>'))
      .toBe('<figure class="table"><div class="table-scroll"><table><tbody><tr><td>1</td></tr></tbody></table></div></figure>');
  });

  it('leaves ordinary bold paragraphs and unrelated images alone', () => {
    const html = '<p><strong>Note: this is bold.</strong></p><p>text <img src="i.png" alt=""></p>';
    expect(run(rehypeCaptions, html)).toBe(html);
  });
});

describe('rehypeHeadingAnchors', () => {
  it('appends an empty labelled link to h2 and h3 with ids', () => {
    expect(run(rehypeHeadingAnchors, '<h2 id="intro">Intro</h2><h4 id="x">X</h4><h3>No id</h3>'))
      .toBe('<h2 id="intro">Intro<a class="anchor" href="#intro" aria-label="Link to this section"></a></h2><h4 id="x">X</h4><h3>No id</h3>');
  });
});
